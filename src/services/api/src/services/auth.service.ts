import { UserRepository } from '../repositories/identity-repositories/user.repository';
import { AccountRepository } from '../repositories/identity-repositories/account.repository';
import { AuthorizationCodeRepository } from '../repositories/identity-repositories/authorization-code.repository';
import {
  comparePassword,
  generateBaseToken,
  generateResetToken,
  hashPassword,
  verifyToken,
  generateAuthorizationCode,
  getAuthCodeExpiresAt,
} from '../utils/auth-utils';
import { env } from '../config/env';
import { prismaWrite } from '@shared/database';
import { recordLoginFailure } from '../utils/securityRecorder';
import type { LoginUserRequest, SignupPayload } from '../../../../types/auth';
import { AccountService } from './account.service';
import { NOTIFICATION_TEMPLATES, NOTIFICATION_CHANNELS } from '../config/constants';
import { logger } from '../config/logger';
import { getQueuePublisher, NotifyService } from './notify.service';
import Notify from 'twilio/lib/rest/Notify';

const userRepo = new UserRepository();
const accountRepo = new AccountRepository();
const authCodeRepo = new AuthorizationCodeRepository();
const accountService = new AccountService();

export class AuthService {
  async register(data: SignupPayload) {
    const existing = await userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error('Email already exists');
    }

    // Validate company account requirements
    if (data.account_type === 'company') {
      if (!data.organizationName || !data.companyEmail) {
        throw new Error('organizationName and companyEmail are required for company accounts');
      }
    }

    const hashed = await hashPassword(data.password);

    // Create user and account(s) based on account_type
    const result = await prismaWrite.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password_hash: hashed,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          location: data.location,
          status: 'ACTIVE',
        },
      });

      if (data.account_type === 'personal') {
        // Create personal organization
        const personalOrg = await tx.organization.create({
          data: {
            name: 'Personal',
            slug: `personal-${user.id.slice(0, 8)}`,
          },
        });

        // Create individual account linked to personal organization
        const account = await tx.account.create({
          data: {
            type: 'INDIVIDUAL',
            owner_user_id: user.id,
            organization_id: personalOrg.id,
          },
        });

        // Add user as OWNER member of the personal organization
        await tx.organizationMember.create({
          data: {
            organization_id: personalOrg.id,
            user_id: user.id,
            role: 'OWNER',
          },
        });

        return { user, account };
      } else if (data.account_type === 'company') {
        // Create organization for company accounts
        const organization = await tx.organization.create({
          data: {
            name: data.organizationName,
            org_email: data.companyEmail,
            location: data.location,
          },
        });

        // Create organization account linked to the organization
        const account = await tx.account.create({
          data: {
            type: 'ORGANIZATION',
            owner_user_id: user.id,
            organization_id: organization.id,
          },
        });

        // Add user as OWNER member of the organization
        await tx.organizationMember.create({
          data: {
            organization_id: organization.id,
            user_id: user.id,
            role: 'OWNER',
          },
        });

        return { user, account, organization };
      }

      throw new Error('Invalid account_type');
    });

    // Create subscription with selected plan or default to FREE
    if (result.account) {
      const plan = data.plan || 'FREE';
      await accountService.createSubscription(result.account.id, plan);
    }

    // Publish email verification message to notify service
    try {
      // Generate verification token and URL
      const verificationToken = generateResetToken(result.user.id, result.user.email);
      const verificationUrl = `${env.WEBAPP_URL}/verify-email?token=${verificationToken}`;

      // Publish verification email notification via queue
      const queuePublisher = getQueuePublisher();
      const notificationId = `verify-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      await queuePublisher.publish({
        notificationId,
        tenantId: env.ACCOUNT_ID, // Use system account ID for transactional emails
        channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
        recipient: result.user.email,
        templateCode: NOTIFICATION_TEMPLATES.AUTH_VERIFY_EMAIL,
        templateId: env.VERIFY_EMAIL_TEMPLATE_ID,
        appId: env.SYSTEM_APP_ID,
        payload: {
          firstName: result.user.firstName,
          verificationUrl,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
        timestamp: new Date(),
      });

      logger.info({ userId: result.user.id, email: result.user.email }, 'Verification email published');
    } catch (emailError) {
      // Log but don't block registration - user can request verification email again
      const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      logger.warn({ error: errorMessage, userId: result.user.id }, 'Failed to publish verification email');
    }
    const token = generateBaseToken(result.user.id, result.user.email, [result.account.id]);

    const response: any = {
      user_id: result.user.id,
      account_id: result.account.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      token,
    };

    if (result.organization) {
      response.organization_id = result.organization.id;
      response.organization_name = result.organization.name;
    }

    return response;
  }

  async login(data: LoginUserRequest, ipAddress?: string) {
    const user = await userRepo.findByEmail(data.email);
    if (!user) {
      // Record failed login - user not found
      await recordLoginFailure(data.email, ipAddress || 'unknown', 'Invalid credentials');
      throw new Error('Invalid credentials');
    }

    const valid = await comparePassword(data.password, user.password_hash);
    if (!valid) {
      // Record failed login - invalid password
      await recordLoginFailure(data.email, ipAddress || 'unknown', 'Invalid password', user.id);
      throw new Error('Invalid credentials');
    }

    // Check email verification status
    if (!user.email_verified) {
      throw new Error('Email not verified');
    }
    // Get all accounts owned by user
    const accounts = await accountRepo.findByUserId(user.id);
    const accountIds = accounts.map((a) => a.id);

    // Record successful login
    await userRepo.recordLoginEvent(user.id, ipAddress || 'unknown');

    // Generate JWT token
    const token = generateBaseToken(user.id, user.email, accountIds);

    return {
      user_id: user.id,
      email: user.email,
      account_ids: accountIds,
      token,
      token_type: 'Bearer',
      expires_in: 604800, // 7 days in seconds
    };
  }

  async exchangeCodeForToken(code: string) {
    // Find the authorization code
    const authCodeRecord = await authCodeRepo.findByCode(code);

    if (!authCodeRecord) {
      throw new Error('Invalid or expired authorization code');
    }

    // Check if code has already been used
    if (authCodeRecord.used_at) {
      throw new Error('Authorization code has already been used');
    }

    // Check if code has expired
    if (new Date() > authCodeRecord.expires_at) {
      throw new Error('Authorization code has expired');
    }

    // Mark code as used to prevent replay attacks
    await authCodeRepo.markAsUsed(authCodeRecord.id);

    // Get user's accounts
    const accounts = await accountRepo.findByUserId(authCodeRecord.user_id);
    const accountIds = accounts.map((a) => a.id);

    // Generate the JWT token
    const token = generateBaseToken(authCodeRecord.user_id, authCodeRecord.user.email, accountIds);

    return {
      user_id: authCodeRecord.user_id,
      email: authCodeRecord.user.email,
      account_ids: accountIds,
      token,
      token_type: 'Bearer',
      expires_in: 604800, // 7 days in seconds
    };
  }

  async forgotPassword(data: any) {
    const user = await userRepo.findByEmail(data.email);
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = generateResetToken(user.id, user.email);
    const resetLink = `${env.WEBAPP_URL}/reset-password?token=${resetToken}`;

    // Send reset password email
    try {
      const queuePublisher = getQueuePublisher();
      const notificationId = `reset-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      await queuePublisher.publish({
        notificationId,
        tenantId: env.ACCOUNT_ID, // Use system account ID for transactional emails
        channel: 'EMAIL',
        recipient: user.email,
        templateCode: NOTIFICATION_TEMPLATES.AUTH_PASSWORD_RESET,
        templateId: env.RESET_PASSWORD_TEMPLATE_ID,
        appId: env.SYSTEM_APP_ID,
        payload: {
          firstName: user.firstName,
          resetLink,
          expirationHours: 24,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
        timestamp: new Date(),
      });

      logger.info({ userId: user.id, email: user.email }, 'Reset password email published');
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      logger.warn({ error: errorMessage, userId: user.id }, 'Failed to publish reset password email');
    }

    return { resetLink };
  }

  async resetPassword(data: any) {
    const { token, newPassword } = data;

    if (!token) {
      throw new Error('Token is required');
    }

    const userData = verifyToken(token);
    if (!userData) {
      throw new Error('Invalid or expired token');
    }

    const userId = userData.userId || userData.sub;
    if (!userId) {
      throw new Error('Invalid token payload');
    }

    const hashed = await hashPassword(newPassword);
    await userRepo.updatePassword(userId, hashed);

    return { message: 'Password reset successfully' };
  }

  async verify(token: string) {
    if (!token) {
      throw new Error('Token is required');
    }

    const userData = verifyToken(token);
    if (!userData) {
      throw new Error('Invalid or expired token');
    }

    const userId = userData.sub || userData.userId;
    if (!userId) {
      throw new Error('Invalid token payload');
    }

    const user = await userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      valid: true,
      user_id: user.id,
      email: user.email,
      token_type: userData.type,
    };
  }

  async verifyEmail(token?: string) {
    if (!token) {
      throw new Error('Token is required');
    }

    const userData = verifyToken(token);
    if (!userData) {
      throw new Error('Invalid or expired token');
    }

    const userId = userData.userId || userData.sub;
    if (!userId) {
      throw new Error('Invalid token payload');
    }

    const user = await userRepo.findById(userId, true);

    if (!user) {
      throw new Error('User not found');
    }

    // Mark email as verified
    await userRepo.updateUser(userId, { email_verified: true });

    return {
      message: 'Email verified successfully',
      user_id: user.id,
      email: user.email,
    };
  }

  async resendVerificationEmail(email: string) {
    if (!email) {
      throw new Error('Email is required');
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security reasons
      return { message: 'Verification email sent if account exists' };
    }

    if (user.email_verified) {
      throw new Error('Email is already verified');
    }

    try {
      const notifyService = new NotifyService();
      const verificationToken = generateResetToken(user.id, user.email);
      const verificationUrl = `${env.WEBAPP_URL}/verify-email?token=${verificationToken}`;
      const userName = user.email.split('@')[0];
      await notifyService.sendNotification(env.ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: 'EMAIL',
        recipient: user.email,
        templateId: env.VERIFY_EMAIL_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload: {
          firstName: userName,
          verificationUrl,
          companyName: env.COMPANY_NAME,
          supportEmail: env.SUPPORT_EMAIL,
        },
        priority: 'HIGH',
      });
      logger.info({ userId: user.id, email: user.email }, 'Resent verification email');
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      logger.warn({ error: errorMessage, userId: user.id }, 'Failed to resend verification email');
      throw new Error('Failed to send verification email');
    }

    return { message: 'Verification email sent' };
  }

  async getProfile(userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const user = await userRepo.findById(userId, true);
    if (!user) {
      throw new Error('User not found');
    }

    // Get user's accounts
    const accounts = await accountRepo.getUserAccounts(userId);

    return {
      user_id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      location: user.location,
      email_verified: user.email_verified,
      status: user.status,
      createdAt: user.createdAt,
      accounts: accounts.map((account) => ({
        id: account.id,
        type: account.type,
        organizationId: account.organization_id,
        createdAt: account.createdAt,
      })),
    };
  }

  async getOrganizationsByUserId(userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user's accounts with their apps and organization info
    const accounts = await accountRepo.getUserAccountsWithAppsAndOrganization(userId);

    // Group by organization
    const organizationsMap = new Map();
    accounts.forEach((account) => {
      const orgId = account.organization_id || 'personal';
      if (!organizationsMap.has(orgId)) {
        organizationsMap.set(orgId, {
          id: orgId,
          name: account.organization?.name || 'Personal',
          slug: account.organization?.slug || 'personal',
          plan: account.subscription?.plan?.name?.toLowerCase() || 'free',
          createdAt: account.organization?.createdAt || account.createdAt,
          apps: [],
        });
      }
      const org = organizationsMap.get(orgId);
      org.apps.push(
        ...account.apps.map((app) => ({
          id: app.id,
          name: app.name,
          environment: app.environment,
          api_key: app.api_key,
          status: app.status,
          createdAt: app.createdAt,
        }))
      );
    });

    return {
      user_id: userId,
      organizations: Array.from(organizationsMap.values()),
    };
  }

  async getUserApps(userId: string) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user's accounts with their apps
    const accounts = await accountRepo.getUserAccountsWithAppsAndOrganization(userId);

    // Flatten apps with organization info and get additional metrics
    const apps = [];
    for (const account of accounts) {
      for (const app of account.apps) {
        // Count templates for this app
        const templateCount = await prismaWrite.appTemplate.count({
          where: { app_id: app.id },
        });

        // Count API keys for this app
        const apiKeyCount = await prismaWrite.apiKey.count({
          where: { account_id: account.id }, // API keys are per account, not per app
        });

        // Count notifications sent for this app
        const notificationCount = await prismaWrite.notification.count({
          where: { account_id: account.id }, // Notifications are per account, not per app
        });

        apps.push({
          id: app.id,
          orgId: account.organization_id || 'personal',
          name: app.name,
          environment: app.environment,
          description: null, // App model doesn't have description yet
          createdAt: app.createdAt,
          templateCount,
          apiKeyCount,
          notificationsSent: notificationCount,
        });
      }
    }

    return {
      user_id: userId,
      apps: apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }
}

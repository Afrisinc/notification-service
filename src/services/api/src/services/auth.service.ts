import { UserRepository } from '../repositories/indentity-repositories/user.repository';
import { AccountRepository } from '../repositories/indentity-repositories/account.repository';
import { AuthorizationCodeRepository } from '../repositories/indentity-repositories/authorization-code.repository';
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
import { getQueuePublisher } from './notify.service';

const userRepo = new UserRepository();
const accountRepo = new AccountRepository();
const authCodeRepo = new AuthorizationCodeRepository();
const accountService = new AccountService();

export class AuthService {
  async register(data: SignupPayload) {
    try {
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
          // Create individual account for personal users
          const account = await tx.account.create({
            data: {
              type: 'INDIVIDUAL',
              owner_user_id: user.id,
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
        console.log('User registered successfully:', { userId: result.user.id, email: result });

        const verificationToken = generateResetToken(result.user.id, result.user.email);
        const verificationUrl = `${env.WEBAPP_URL}/verify-email?token=${verificationToken}`;

        // Publish verification email notification via queue
        const queuePublisher = getQueuePublisher();
        const notificationId = `verif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        await queuePublisher.publish({
          notificationId,
          tenantId: result.account.id,
          channel: NOTIFICATION_CHANNELS.EMAIL as 'EMAIL',
          recipient: result.user.email,
          templateCode: NOTIFICATION_TEMPLATES.AUTH_VERIFY_EMAIL,
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
      console.log('User registered successfully:', { userId: result.user.id, email: result });
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
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
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

    console.log('Decoded token data:', userData);

    const user = await userRepo.findById(userId, true);
    console.log('Found user:', user);

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
}

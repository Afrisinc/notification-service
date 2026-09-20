import { prismaRead } from '@shared/database';
import { comparePassword, hashPassword } from '../utils/auth-utils';
import {
  generateRecipientBootstrapToken,
  generateRecipientResetToken,
  generateRecipientSessionToken,
  verifyRecipientToken,
} from '../utils/recipient-auth-utils';
import {
  RecipientIdentityRepository,
  RecipientLoginFailureRepository,
} from '../repositories/recipient-identity.repository';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { NotifyService } from './notify.service';

const LOGIN_FAILURE_THRESHOLD = 5;
const LOGIN_FAILURE_WINDOW_MINUTES = 15;

export class RecipientAuthService {
  /**
   * Requests access to the mail portal. Only sends a "set password" link if
   * mail actually exists for this address (checked against EmailThread) -
   * this doubles as the anti-enumeration guard and the lazy RecipientIdentity
   * creation trigger. Always returns a generic result either way.
   */
  async requestAccess(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const hasMail = await prismaRead.emailThread.findFirst({ where: { contact_email: normalizedEmail } });
    if (!hasMail) {
      return { message: 'If that address has received mail on this platform, an access link has been sent.' };
    }

    await RecipientIdentityRepository.findOrCreate(normalizedEmail);

    const token = generateRecipientBootstrapToken(normalizedEmail);
    const accessUrl = `${env.WEBAPP_URL}/mail/set-password?token=${token}`;

    try {
      const notifyService = new NotifyService();
      await notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
        channel: 'EMAIL',
        recipient: normalizedEmail,
        templateId: env.RECIPIENT_ACCESS_TEMPLATE_ID,
        app_id: env.SYSTEM_APP_ID,
        payload: { accessUrl, companyName: env.COMPANY_NAME, supportEmail: env.SUPPORT_EMAIL },
        priority: 'HIGH',
      });
      logger.info({ email: normalizedEmail }, 'Recipient access link sent');
    } catch (error) {
      logger.warn({ error, email: normalizedEmail }, 'Failed to send recipient access link');
    }

    return { message: 'If that address has received mail on this platform, an access link has been sent.' };
  }

  async setPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const payload =
      verifyRecipientToken(token, 'recipient_bootstrap') || verifyRecipientToken(token, 'recipient_reset');
    if (!payload) {
      throw new Error('Invalid or expired token');
    }

    const identity = await RecipientIdentityRepository.findOrCreate(payload.email);
    const passwordHash = await hashPassword(newPassword);
    await RecipientIdentityRepository.setPassword(identity.id, passwordHash);

    return { message: 'Password set successfully' };
  }

  async login(
    email: string,
    password: string,
    ipAddress: string
  ): Promise<{ token: string; email: string; expiresIn: number }> {
    const normalizedEmail = email.toLowerCase().trim();

    const recentFailures = await RecipientLoginFailureRepository.countRecent(
      normalizedEmail,
      ipAddress,
      LOGIN_FAILURE_WINDOW_MINUTES
    );
    if (recentFailures >= LOGIN_FAILURE_THRESHOLD) {
      throw new Error('Too many failed attempts. Please try again later.');
    }

    const identity = await RecipientIdentityRepository.findByEmail(normalizedEmail);
    if (!identity || !identity.password_hash) {
      await RecipientLoginFailureRepository.record(normalizedEmail, ipAddress, 'Invalid credentials');
      throw new Error('Invalid credentials');
    }

    const valid = await comparePassword(password, identity.password_hash);
    if (!valid) {
      await RecipientLoginFailureRepository.record(normalizedEmail, ipAddress, 'Invalid password', identity.id);
      throw new Error('Invalid credentials');
    }

    const token = generateRecipientSessionToken(identity.id, identity.email);
    return { token, email: identity.email, expiresIn: 604800 };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const identity = await RecipientIdentityRepository.findByEmail(normalizedEmail);

    if (identity) {
      const token = generateRecipientResetToken(identity.id, identity.email);
      const resetUrl = `${env.WEBAPP_URL}/mail/reset-password?token=${token}`;

      try {
        const notifyService = new NotifyService();
        await notifyService.sendNotification(env.SYSTEM_ACCOUNT_ID, env.SYSTEM_APP_ID, {
          channel: 'EMAIL',
          recipient: identity.email,
          templateId: env.RECIPIENT_RESET_PASSWORD_TEMPLATE_ID,
          app_id: env.SYSTEM_APP_ID,
          payload: { resetUrl, companyName: env.COMPANY_NAME, supportEmail: env.SUPPORT_EMAIL },
          priority: 'HIGH',
        });
      } catch (error) {
        logger.warn({ error, email: normalizedEmail }, 'Failed to send recipient reset password email');
      }
    }

    return { message: 'If that account exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const payload = verifyRecipientToken(token, 'recipient_reset');
    if (!payload || !payload.sub) {
      throw new Error('Invalid or expired token');
    }

    const passwordHash = await hashPassword(newPassword);
    await RecipientIdentityRepository.setPassword(payload.sub, passwordHash);

    return { message: 'Password reset successfully' };
  }
}

export const recipientAuthService = new RecipientAuthService();

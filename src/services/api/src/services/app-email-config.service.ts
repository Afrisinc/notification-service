import { logger } from '../config/logger';
import {
  AppEmailConfigRepository,
  CreateAppEmailConfigDTO,
  UpdateAppEmailConfigDTO,
} from '../repositories/app-email-config.repository';
import { getConfig } from '@shared/config';

export class AppEmailConfigService {
  /**
   * Get email config for app or return default
   */
  static async getEmailConfigForApp(appId: string) {
    try {
      const config = await AppEmailConfigRepository.getByAppId(appId);

      if (config) {
        return {
          fromEmail: config.from_email,
          fromName: config.from_name,
          replyToEmail: config.reply_to_email,
          replyToName: config.reply_to_name,
          isVerified: config.is_verified,
        };
      }

      // Return default platform config if no app-specific config
      const platformConfig = getConfig();
      return {
        fromEmail: platformConfig.FROM_EMAIL || platformConfig.SMTP_FROM || 'noreply@notification.local',
        fromName: 'Afrisinc',
        replyToEmail: undefined,
        replyToName: undefined,
        isVerified: true,
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get email config for app');
      // Return default on error
      const platformConfig = getConfig();
      return {
        fromEmail: platformConfig.FROM_EMAIL || platformConfig.SMTP_FROM || 'noreply@notification.local',
        fromName: 'Afrisinc',
        replyToEmail: undefined,
        replyToName: undefined,
        isVerified: true,
      };
    }
  }

  /**
   * Set custom email config for app
   */
  static async setEmailConfig(appId: string, data: UpdateAppEmailConfigDTO) {
    try {
      // Verify app exists
      const { prismaRead } = await import('@shared/database');
      const app = await prismaRead.app.findUnique({
        where: { id: appId },
      });

      if (!app) {
        throw new Error('App not found');
      }

      // Check if config exists
      const existing = await AppEmailConfigRepository.getByAppId(appId);

      if (existing) {
        // Update existing config
        return await AppEmailConfigRepository.update(appId, data);
      }

      // Create new config with defaults
      return await AppEmailConfigRepository.createOrGet({
        appId,
        fromEmail: data.fromEmail || getConfig().FROM_EMAIL || 'noreply@notification.local',
        fromName: data.fromName,
        replyToEmail: data.replyToEmail,
        replyToName: data.replyToName,
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to set email config');
      throw error;
    }
  }

  /**
   * Reset to platform default
   */
  static async resetToDefault(appId: string) {
    try {
      await AppEmailConfigRepository.delete(appId);
      logger.info({ appId }, 'Email config reset to default');
      return { success: true };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to reset email config');
      throw error;
    }
  }

  /**
   * Validate email address format
   */
  static validateEmailAddress(email: string): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

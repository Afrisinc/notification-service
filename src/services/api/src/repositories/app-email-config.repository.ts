import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

export interface CreateAppEmailConfigDTO {
  appId: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  replyToName?: string;
}

export interface UpdateAppEmailConfigDTO {
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  replyToName?: string;
  isVerified?: boolean;
}

export class AppEmailConfigRepository {
  /**
   * Create or get email config for an app
   */
  static async createOrGet(data: CreateAppEmailConfigDTO) {
    try {
      const existing = await prismaRead.appEmailConfig.findUnique({
        where: { app_id: data.appId },
      });

      if (existing) {
        return existing;
      }

      return await prismaWrite.appEmailConfig.create({
        data: {
          app_id: data.appId,
          from_email: data.fromEmail,
          from_name: data.fromName,
          reply_to_email: data.replyToEmail,
          reply_to_name: data.replyToName,
        },
      });
    } catch (error) {
      logger.error({ error, appId: data.appId }, 'Failed to create or get email config');
      throw error;
    }
  }

  /**
   * Get email config for an app
   */
  static async getByAppId(appId: string) {
    try {
      return await prismaRead.appEmailConfig.findUnique({
        where: { app_id: appId },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get email config');
      throw error;
    }
  }

  /**
   * Get email config with app details
   */
  static async getWithApp(appId: string) {
    try {
      return await prismaRead.appEmailConfig.findUnique({
        where: { app_id: appId },
        include: { app: true },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get email config with app');
      throw error;
    }
  }

  /**
   * Update email config
   */
  static async update(appId: string, data: UpdateAppEmailConfigDTO) {
    try {
      return await prismaWrite.appEmailConfig.update({
        where: { app_id: appId },
        data: {
          from_email: data.fromEmail,
          from_name: data.fromName,
          reply_to_email: data.replyToEmail,
          reply_to_name: data.replyToName,
          is_verified: data.isVerified,
        },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update email config');
      throw error;
    }
  }

  /**
   * Delete email config
   */
  static async delete(appId: string) {
    try {
      return await prismaWrite.appEmailConfig.delete({
        where: { app_id: appId },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to delete email config');
      throw error;
    }
  }

  /**
   * Verify email address (mark as verified)
   */
  static async markAsVerified(appId: string) {
    try {
      return await prismaWrite.appEmailConfig.update({
        where: { app_id: appId },
        data: { is_verified: true },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to mark email as verified');
      throw error;
    }
  }
}

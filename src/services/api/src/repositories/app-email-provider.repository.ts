import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';
import type { EmailProvider, CustomerDomainStatus } from '@prisma/client';

export interface SimpleConfig {
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  replyToName?: string;
}

export interface GmailOAuth2Config {
  gmailEmail: string;
  oauthAccessToken: string;
  oauthRefreshToken?: string;
  oauthTokenExpiry?: Date;
}

export interface GmailAppPasswordConfig {
  gmailEmail: string;
  appPassword: string;
}

export interface CustomDomainConfig {
  domain: string;
  fromName: string;
  fromEmail: string;
  selector?: string;
  publicKey?: string;
  privateKeyPath?: string;
  spfVerified?: boolean;
  dkimVerified?: boolean;
  dmarcVerified?: boolean;
  status?: CustomerDomainStatus;
}

export type CreateEmailProviderDTO =
  | ({ appId: string; method: 'simple' } & SimpleConfig)
  | ({ appId: string; method: 'gmail_oauth2' } & GmailOAuth2Config)
  | ({ appId: string; method: 'gmail_password' } & GmailAppPasswordConfig)
  | ({ appId: string; method: 'custom_domain' } & CustomDomainConfig);

export class AppEmailProviderRepository {
  /**
   * Find email provider config by app ID
   */
  static async findByAppId(appId: string) {
    try {
      return await prismaRead.appEmailProvider.findUnique({
        where: { app_id: appId },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to find email provider config');
      throw error;
    }
  }

  /**
   * Create or update email provider config (upsert)
   */
  static async upsert(appId: string, data: any) {
    try {
      return await prismaWrite.appEmailProvider.upsert({
        where: { app_id: appId },
        update: data,
        create: {
          app_id: appId,
          ...data,
        },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to upsert email provider config');
      throw error;
    }
  }

  /**
   * Update email provider config
   */
  static async update(appId: string, data: any) {
    try {
      return await prismaWrite.appEmailProvider.update({
        where: { app_id: appId },
        data,
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update email provider config');
      throw error;
    }
  }

  /**
   * Delete email provider config (reset to default)
   */
  static async delete(appId: string) {
    try {
      return await prismaWrite.appEmailProvider.delete({
        where: { app_id: appId },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to delete email provider config');
      throw error;
    }
  }

  /**
   * Get active email provider for an app
   */
  static async getActive(appId: string) {
    try {
      return await prismaRead.appEmailProvider.findUnique({
        where: { app_id: appId },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get active email provider');
      throw error;
    }
  }

  /**
   * Update verification status for custom domain
   */
  static async updateDomainVerification(
    appId: string,
    data: {
      spfVerified?: boolean;
      dkimVerified?: boolean;
      dmarcVerified?: boolean;
      status?: CustomerDomainStatus;
    }
  ) {
    try {
      return await prismaWrite.appEmailProvider.update({
        where: { app_id: appId },
        data: {
          spf_verified: data.spfVerified,
          dkim_verified: data.dkimVerified,
          dmarc_verified: data.dmarcVerified,
          domain_status: data.status,
          domain_verified_at: data.status === 'verified' ? new Date() : undefined,
        },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update domain verification');
      throw error;
    }
  }

  /**
   * Update OAuth token
   */
  static async updateOAuthToken(appId: string, accessToken: string, refreshToken?: string, expiryDate?: Date) {
    try {
      return await prismaWrite.appEmailProvider.update({
        where: { app_id: appId },
        data: {
          oauth_access_token: accessToken,
          oauth_refresh_token: refreshToken,
          oauth_token_expiry: expiryDate,
        },
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to update OAuth token');
      throw error;
    }
  }
}

import { AppEmailProviderRepository } from '../repositories/app-email-provider.repository';
import { prismaRead } from '@shared/database';
import { getConfig } from '@shared/config';
import { encrypt } from '@shared/utils/encryption';
import { logger } from '../config/logger';
import nodemailer from 'nodemailer';

export class AppEmailProviderService {
  async getEmailProvider(appId: string) {
    try {
      return await AppEmailProviderRepository.findByAppId(appId);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get email provider');
      throw error;
    }
  }

  /**
   * Set simple sender configuration
   */
  async setSimpleConfig(
    appId: string,
    data: {
      fromEmail: string;
      fromName?: string;
      replyToEmail?: string;
      replyToName?: string;
    }
  ) {
    try {
      return await AppEmailProviderRepository.upsert(appId, {
        provider: 'notify',
        method: null,
        from_email: data.fromEmail,
        from_name: data.fromName || null,
        reply_to_email: data.replyToEmail || null,
        reply_to_name: data.replyToName || null,
        is_active: true,
        // Clear Gmail fields
        gmail_email: null,
        oauth_access_token: null,
        oauth_refresh_token: null,
        oauth_token_expiry: null,
        app_password: null,
        // Clear Custom Domain fields
        domain: null,
        domain_status: 'pending',
        selector: null,
        public_key: null,
        private_key_path: null,
        spf_verified: false,
        dkim_verified: false,
        dmarc_verified: false,
      });
    } catch (error) {
      logger.error({ error, appId }, 'Failed to set simple config');
      throw error;
    }
  }

  /**
   * Generate Google OAuth2 authorization URL
   */
  async getGmailOAuthUrl(appId: string): Promise<{ url: string; state: string }> {
    try {
      const config = getConfig();
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_REDIRECT_URI) {
        throw new Error('Google OAuth is not configured on the server');
      }

      const state = Buffer.from(`${appId}:${Date.now()}:${Math.random()}`).toString('base64');

      const params = new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        redirect_uri: config.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
        state,
        access_type: 'offline',
        prompt: 'consent',
      });

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return { url, state };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to generate OAuth URL');
      throw error;
    }
  }

  /**
   * Handle Gmail OAuth callback and store encrypted tokens
   */
  async handleGmailOAuthCallback(appId: string, code: string, state: string, accountId?: string) {
    try {
      const config = getConfig();
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) {
        throw new Error('Google OAuth is not configured on the server');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.GOOGLE_CLIENT_ID,
          client_secret: config.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.GOOGLE_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        logger.error({ error, appId }, 'Failed to exchange OAuth code');
        throw new Error('Failed to exchange authorization code');
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        logger.error({ appId }, 'Failed to get user info from Google');
        throw new Error('Failed to retrieve user information from Google');
      }

      const userInfo = (await userInfoResponse.json()) as { email: string };

      // Encrypt tokens before storing
      const encryptedAccessToken = encrypt(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      // Store configuration
      const emailConfig = await AppEmailProviderRepository.upsert(appId, {
        provider: 'gmail',
        method: 'oauth2',
        gmail_email: userInfo.email,
        oauth_access_token: encryptedAccessToken,
        oauth_refresh_token: encryptedRefreshToken,
        oauth_token_expiry: tokenExpiry,
        is_active: true,
        // Clear other fields
        from_email: null,
        from_name: null,
        app_password: null,
        domain: null,
        domain_status: 'pending',
        selector: null,
        public_key: null,
        private_key_path: null,
        spf_verified: false,
        dkim_verified: false,
        dmarc_verified: false,
      });

      logger.info({ appId, gmailEmail: userInfo.email }, 'Gmail OAuth2 configured');

      return emailConfig;
    } catch (error) {
      logger.error({ error, appId }, 'Failed to handle OAuth callback');
      throw error;
    }
  }

  /**
   * Verify Gmail app password credentials by testing SMTP connection
   */
  async verifyGmailAppPassword(email: string, appPassword: string): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: email,
          pass: appPassword,
        },
      });

      await transporter.verify();
      logger.debug({ email }, 'Gmail credentials verified successfully');
      return true;
    } catch (error) {
      logger.warn({ error, email }, 'Gmail credentials verification failed');
      return false;
    }
  }

  /**
   * Set Gmail app password configuration
   */
  async setGmailAppPassword(appId: string, email: string, appPassword: string) {
    try {
      const isValid = await this.verifyGmailAppPassword(email, appPassword);
      if (!isValid) {
        throw new Error('Invalid Gmail credentials. Please verify your email and app password are correct.');
      }

      const encryptedPassword = encrypt(appPassword);

      const emailConfig = await AppEmailProviderRepository.upsert(appId, {
        provider: 'gmail',
        method: 'app_password',
        gmail_email: email,
        app_password: encryptedPassword,
        is_active: true,
      });

      logger.info({ appId, email }, 'Gmail app password configured');

      return emailConfig;
    } catch (error) {
      logger.error({ error, appId }, 'Failed to set Gmail app password');
      throw error;
    }
  }

  /**
   * Reset email provider to default
   */
  async resetEmailProvider(appId: string) {
    try {
      const config = await AppEmailProviderRepository.findByAppId(appId);
      if (!config) {
        return null;
      }

      await AppEmailProviderRepository.delete(appId);
      logger.info({ appId }, 'Email provider reset to default');

      return true;
    } catch (error) {
      logger.error({ error, appId }, 'Failed to reset email provider');
      throw error;
    }
  }

  /**
   * Verify app ownership
   */
  async verifyAppOwnership(appId: string, accountId?: string): Promise<boolean> {
    try {
      const app = await prismaRead.app.findUnique({
        where: { id: appId },
      });
      if (!app) return false;
      if (!accountId) return true;
      return app.account_id === accountId;
    } catch (error) {
      logger.error({ error, appId, accountId }, 'Failed to verify app ownership');
      return false;
    }
  }
}

export const appEmailProviderService = new AppEmailProviderService();

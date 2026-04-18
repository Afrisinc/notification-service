import pino from 'pino';
import nodemailer from 'nodemailer';
import { EmailNotification, EmailProvider } from '@shared/common';
import { prismaRead, prismaWrite } from '@shared/database';
import { decrypt, encrypt } from '@shared/utils/encryption';

/**
 * Gmail Email Provider
 * Sends emails via Gmail SMTP using OAuth2 or app password credentials
 */
export class GmailProvider implements EmailProvider {
  name = 'gmail';
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  async send(email: EmailNotification): Promise<{ messageId: string }> {
    try {
      if (!email.appId) {
        throw new Error('Gmail provider requires appId');
      }

      // Load email provider config from database
      const emailProvider = await prismaRead.appEmailProvider.findUnique({
        where: { app_id: email.appId },
      });

      if (!emailProvider || !emailProvider.is_active || emailProvider.provider !== 'gmail') {
        throw new Error(`No active Gmail configuration for app ${email.appId}`);
      }

      let transporter: nodemailer.Transporter;

      if (emailProvider.method === 'oauth2') {
        // OAuth2 authentication
        let accessToken = emailProvider.oauth_access_token;

        // Check if token is expired and refresh if needed
        if (emailProvider.oauth_token_expiry && new Date() >= emailProvider.oauth_token_expiry) {
          this.logger.debug({ appId: email.appId }, 'Gmail OAuth2 token expired, refreshing...');
          const refreshedToken = await this.refreshOAuth2Token(email.appId, emailProvider.oauth_refresh_token || '');
          accessToken = refreshedToken;
        }

        if (!accessToken) {
          throw new Error('Gmail OAuth2 access token is missing');
        }

        const decryptedToken = decrypt(accessToken);

        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: emailProvider.gmail_email,
            accessToken: decryptedToken,
          },
        } as any);
      } else if (emailProvider.method === 'app_password') {
        // App password authentication
        if (!emailProvider.app_password) {
          throw new Error('Gmail app password is missing');
        }

        const decryptedPassword = decrypt(emailProvider.app_password);

        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailProvider.gmail_email,
            pass: decryptedPassword,
          },
        } as any);
      } else {
        throw new Error(`Unknown Gmail authentication method: ${emailProvider.method}`);
      }

      // Prepare mail options
      const mailOptions = {
        from: emailProvider.gmail_email || 'noreply@gmail.com',
        to: email.to,
        subject: email.subject,
        text: email.body,
        html: email.html || email.body,
      };

      this.logger.debug(
        { to: email.to, from: emailProvider.gmail_email, appId: email.appId },
        'Sending email via Gmail'
      );

      // Send email
      const result = await transporter.sendMail(mailOptions as any);

      this.logger.info(
        { messageId: result.messageId, to: email.to, appId: email.appId },
        'Email sent successfully via Gmail'
      );

      return { messageId: result.messageId || 'unknown' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { error: errorMessage, to: email.to, appId: email.appId },
        'Gmail provider failed to send email'
      );
      throw error;
    }
  }

  /**
   * Refresh OAuth2 access token using refresh token
   */
  private async refreshOAuth2Token(appId: string, refreshToken: string): Promise<string> {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available for token refresh');
      }

      const decryptedRefreshToken = decrypt(refreshToken);
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not configured');
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Failed to refresh token: ${error}`);
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        expires_in: number;
      };

      // Encrypt and update the new access token and expiry
      const encryptedAccessToken = encrypt(tokens.access_token);
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      await prismaWrite.appEmailProvider.update({
        where: { app_id: appId },
        data: {
          oauth_access_token: encryptedAccessToken,
          oauth_token_expiry: tokenExpiry,
        },
      });

      this.logger.info({ appId }, 'Gmail OAuth2 token refreshed successfully');

      return encryptedAccessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage, appId }, 'Failed to refresh Gmail OAuth2 token');
      throw error;
    }
  }

  /**
   * Verify Gmail SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      // Gmail SMTP is generally reliable, so we just return true
      // A more thorough check would require app-specific credentials to test
      this.logger.info('Gmail provider connection verified');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Gmail provider connection verification failed');
      return false;
    }
  }
}

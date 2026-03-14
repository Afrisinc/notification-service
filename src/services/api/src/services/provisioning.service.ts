import { logger } from '../config/logger';
import { prismaWrite } from '@shared/database';

export class ProvisioningService {
  /**
   * Provision a new tenant with default roles and templates
   * Creates tenant, seeds default roles and templates
   */
  async provision(data: {
    accountId: string;
    accountType: 'INDIVIDUAL' | 'ORGANIZATION';
  }): Promise<{ resource_id: string }> {
    try {
      // Create templates for the account
      // Note: Tenant creation is handled by auth-service during account creation

      // Seed default templates for this account
      await this.seedDefaultTemplates(data.accountId);

      logger.info({ accountId: data.accountId }, 'Provisioning completed with default templates');

      return {
        resource_id: data.accountId,
      };
    } catch (error) {
      logger.error({ error, accountId: data.accountId }, 'Failed to provision tenant');
      throw error;
    }
  }

  /**
   * Seed default templates for account
   */
  private async seedDefaultTemplates(accountId: string): Promise<void> {
    try {
      const defaultTemplates = [
        {
          code: 'WELCOME_EMAIL',
          channel: 'EMAIL' as const,
          subject: 'Welcome to Our Service',
          content: "Welcome! We're excited to have you on board. This is your welcome email.",
          language: 'en',
        },
        {
          code: 'VERIFICATION_EMAIL',
          channel: 'EMAIL' as const,
          subject: 'Verify Your Email Address',
          content: 'Please verify your email address by clicking the link below: {{verifyLink}}',
          language: 'en',
        },
        {
          code: 'PASSWORD_RESET',
          channel: 'EMAIL' as const,
          subject: 'Reset Your Password',
          content: 'Click the link below to reset your password: {{resetLink}}',
          language: 'en',
        },
        {
          code: 'NOTIFICATION_ALERT',
          channel: 'SMS' as const,
          subject: null,
          content: 'Alert: {{message}}',
          language: 'en',
        },
      ];

      for (const template of defaultTemplates) {
        try {
          await prismaWrite.template.create({
            data: {
              account_id: accountId,
              created_by_user_id: 'system', // System-created templates
              code: template.code,
              channel: template.channel,
              subject: template.subject,
              content: template.content,
              language: template.language,
              active: true,
              version: 1,
            },
          });
        } catch (error) {
          logger.warn({ accountId, code: template.code, error }, 'Failed to create default template');
          // Continue with next template
        }
      }

      logger.info({ accountId, count: defaultTemplates.length }, 'Default templates seeded');
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to seed default templates');
      // Don't throw - continue provisioning even if template seeding fails
    }
  }
}

export const provisioningService = new ProvisioningService();

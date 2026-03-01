import { logger } from '../config/logger';
import { tenantRepository } from '../repositories/tenant.repository';
import { db } from '@shared/db';

const prisma = db;

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
      // Generate tenant code from account ID
      const tenantCode = `tenant-${data.accountId}`;

      // Check if tenant already exists
      const existingTenant = await tenantRepository.findByCode(tenantCode);
      if (existingTenant) {
        throw new Error(`Tenant with account_id ${data.accountId} already exists`);
      }

      // Create tenant
      const tenant = await tenantRepository.create({
        code: tenantCode,
        name: `Tenant ${data.accountId}`,
        accountId: data.accountId,
        accountType: data.accountType,
      });

      logger.info({ tenantId: tenant.id, accountId: data.accountId }, 'Tenant created during provisioning');

      // Seed default templates
      await this.seedDefaultTemplates(tenant.id);

      // Seed default roles (if roles table exists)
      await this.seedDefaultRoles(tenant.id);

      logger.info({ tenantId: tenant.id }, 'Provisioning completed with default templates and roles');

      return {
        resource_id: tenant.id,
      };
    } catch (error) {
      logger.error({ error, accountId: data.accountId }, 'Failed to provision tenant');
      throw error;
    }
  }

  /**
   * Seed default templates for tenant
   */
  private async seedDefaultTemplates(tenantId: string): Promise<void> {
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
        await prisma.template.create({
          data: {
            tenantId,
            code: template.code,
            channel: template.channel,
            subject: template.subject,
            content: template.content,
            language: template.language,
            active: true,
            version: 1,
          },
        });
      }

      logger.info({ tenantId, count: defaultTemplates.length }, 'Default templates seeded');
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to seed default templates');
      // Don't throw - continue provisioning even if template seeding fails
    }
  }

  /**
   * Seed default roles for tenant
   * Placeholder for future role-based access control
   */
  private async seedDefaultRoles(tenantId: string): Promise<void> {
    try {
      // Placeholder: Add role seeding logic here when role model exists
      // Default roles: ADMIN, USER, VIEWER
      logger.debug({ tenantId }, 'Default roles seeding skipped (role model not yet implemented)');
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to seed default roles');
      // Don't throw - continue provisioning even if role seeding fails
    }
  }
}

export const provisioningService = new ProvisioningService();

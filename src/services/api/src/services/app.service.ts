import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { AppRepository } from '../repositories/app.repository';
import { appTemplateRepository } from '../repositories/template-installation.repository';
import { prismaRead } from '@shared/database';

const appRepo = new AppRepository();

export interface CreateAppRequest {
  name: string;
  environment: 'production' | 'staging' | 'development';
  description?: string;
  account_id: string;
  organization_id?: string;
}

export interface AppResponse {
  id: string;
  account_id: string;
  organization_id?: string;
  name: string;
  environment: string;
  api_key: string;
  status: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  templateCount?: number;
  apiKeyCount?: number;
  notificationsSent?: number;
}

export class AppService {
  async createApp(data: CreateAppRequest): Promise<AppResponse> {
    if (!data.name || !data.environment || !data.account_id) {
      throw new Error('Name, environment, and account_id are required');
    }

    // Fetch the account to get its organization
    const account = await appRepo.findAccountById(data.account_id);
    if (!account) {
      throw new Error('Account not found');
    }

    // Generate unique API key
    const apiKey = `sk_${data.environment}_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    try {
      const app = await appRepo.create({
        account_id: data.account_id,
        organization_id: account.organization_id, // Attach the account's organization
        name: data.name,
        environment: data.environment as any,
        api_key: apiKey,
        status: 'active',
      });

      logger.info(
        {
          appId: app.id,
          name: app.name,
          environment: app.environment,
          accountId: data.account_id,
          organizationId: account.organization_id,
        },
        'App created successfully'
      );

      return {
        id: app.id,
        account_id: app.account_id,
        name: app.name,
        environment: app.environment,
        api_key: apiKey,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    } catch (error) {
      logger.error({ error, data }, 'Failed to create app');
      throw new Error('Failed to create application');
    }
  }

  async getApp(appId: string, accountId: string): Promise<AppResponse> {
    const app = await appRepo.findById(appId);

    if (!app) {
      throw new Error('App not found');
    }

    // Verify account belongs to same organization as app
    const account = await appRepo.findAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (app.organization_id !== account.organization_id) {
      throw new Error('Unauthorized access to this app');
    }

    const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
      prismaRead.appTemplate.count({ where: { app_id: appId } }),
      prismaRead.notification.count({ where: { account_id: accountId } }),
      prismaRead.apiKey.count({ where: { app_id: appId } }),
    ]);

    return {
      id: app.id,
      account_id: app.account_id,
      organization_id: app.organization_id || undefined,
      name: app.name,
      environment: app.environment,
      api_key: app.api_key,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      templateCount,
      notificationsSent: notificationCount,
      apiKeyCount,
    };
  }

  async listAppsByAccount(accountId: string): Promise<AppResponse[]> {
    const apps = await appRepo.findByAccountId(accountId);

    const enrichedApps: AppResponse[] = [];

    for (const app of apps) {
      const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
        prismaRead.appTemplate.count({ where: { app_id: app.id } }),
        prismaRead.notification.count({ where: { account_id: accountId } }),
        prismaRead.apiKey.count({ where: { app_id: app.id } }),
      ]);

      enrichedApps.push({
        id: app.id,
        account_id: app.account_id,
        organization_id: app.organization_id || undefined,
        name: app.name,
        environment: app.environment,
        api_key: app.api_key,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        templateCount,
        notificationsSent: notificationCount,
        apiKeyCount,
      });
    }

    return enrichedApps;
  }

  async updateApp(
    appId: string,
    accountId: string,
    data: Partial<{ name: string; environment: string; status: string }>
  ): Promise<AppResponse> {
    const isOwner = await appRepo.validateOwnership(appId, accountId);

    if (!isOwner) {
      throw new Error('Unauthorized access to this app');
    }

    const updated = await appRepo.update(appId, data);

    logger.info({ appId, changes: data }, 'App updated');

    return {
      id: updated.id,
      account_id: updated.account_id,
      name: updated.name,
      environment: updated.environment,
      api_key: updated.api_key,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteApp(appId: string, accountId: string): Promise<void> {
    const isOwner = await appRepo.validateOwnership(appId, accountId);

    if (!isOwner) {
      throw new Error('Unauthorized access to this app');
    }

    await appRepo.delete(appId);

    logger.info({ appId }, 'App deleted');
  }

  async rotateApiKey(appId: string, accountId: string): Promise<string> {
    const isOwner = await appRepo.validateOwnership(appId, accountId);

    if (!isOwner) {
      throw new Error('Unauthorized access to this app');
    }

    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    const newApiKey = `sk_${app.environment}_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    await appRepo.update(appId, { api_key: newApiKey });

    logger.info({ appId }, 'API key rotated');

    return newApiKey;
  }

  async getAppsByOrganization(organizationId: string): Promise<AppResponse[]> {
    // Get apps directly from organization
    const apps = await appRepo.findByOrganizationId(organizationId);

    const enrichedApps: AppResponse[] = [];

    for (const app of apps) {
      const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
        prismaRead.appTemplate.count({ where: { app_id: app.id } }),
        prismaRead.notification.count({ where: { account_id: app.account_id } }),
        prismaRead.apiKey.count({ where: { account_id: app.account_id } }),
      ]);

      enrichedApps.push({
        id: app.id,
        account_id: app.account_id,
        organization_id: app.organization_id || undefined,
        name: app.name,
        environment: app.environment,
        api_key: app.api_key,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        templateCount,
        notificationsSent: notificationCount,
        apiKeyCount,
      });
    }

    return enrichedApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAppTemplate(
    appId: string,
    accountId: string,
    data: {
      template_id: string;
      customizations?: Record<string, any>;
      status?: 'active' | 'archived' | 'disabled';
    }
  ) {
    // Verify app exists and account has access
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    const account = await appRepo.findAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (app.organization_id !== account.organization_id) {
      throw new Error('Unauthorized access to this app');
    }

    // Verify template exists
    const template = await prismaRead.template.findUnique({
      where: { id: data.template_id },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Check if template is already installed
    const existingInstallation = await appTemplateRepository.findByAppAndTemplate(appId, data.template_id);

    if (existingInstallation) {
      throw new Error('Template already installed on this app');
    }

    // Create app template installation
    const appTemplate = await appTemplateRepository.create({
      app_id: appId,
      template_id: data.template_id,
      customizations: data.customizations || {},
    });

    // Fetch with template details
    const installation = await prismaRead.appTemplate.findUnique({
      where: { id: appTemplate.id },
      include: {
        template: {
          select: {
            id: true,
            code: true,
            channel: true,
            category: true,
            subject: true,
            content: true,
            language: true,
            version: true,
            active: true,
            requiredVariables: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    logger.info(
      {
        appId,
        templateId: data.template_id,
        templateCode: template.code,
      },
      'Template installed on app'
    );

    return {
      installationId: appTemplate.id,
      appId,
      status: appTemplate.status,
      customizations: appTemplate.customizations,
      installationDate: appTemplate.installationDate,
      template: {
        id: (installation as any).template.id,
        code: (installation as any).template.code,
        channel: (installation as any).template.channel,
        category: (installation as any).template.category,
        subject: (installation as any).template.subject,
        content: (installation as any).template.content,
        language: (installation as any).template.language,
        version: (installation as any).template.version,
        active: (installation as any).template.active,
        requiredVariables: (installation as any).template.requiredVariables,
        description: (installation as any).template.description,
        createdAt: (installation as any).template.createdAt,
        updatedAt: (installation as any).template.updatedAt,
      },
    };
  }

  async getAppTemplateById(appId: string, templateId: string, accountId: string) {
    // Verify app exists and account has access
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    const account = await appRepo.findAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (app.organization_id !== account.organization_id) {
      throw new Error('Unauthorized access to this app');
    }

    // Get specific app template using repository
    const appTemplate = await appTemplateRepository.findByAppAndTemplate(appId, templateId);

    if (!appTemplate) {
      throw new Error('Template not found for this app');
    }

    // Get template details
    const template = await prismaRead.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        code: true,
        channel: true,
        category: true,
        subject: true,
        content: true,
        language: true,
        version: true,
        active: true,
        requiredVariables: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      installationId: appTemplate.id,
      appId,
      status: appTemplate.status,
      customizations: appTemplate.customizations,
      installationDate: appTemplate.installationDate,
      updatedAt: appTemplate.updatedAt,
      template: {
        id: (template as any).id,
        code: (template as any).code,
        channel: (template as any).channel,
        category: (template as any).category,
        subject: (template as any).subject,
        content: (template as any).content,
        language: (template as any).language,
        version: (template as any).version,
        active: (template as any).active,
        requiredVariables: (template as any).requiredVariables,
        description: (template as any).description,
        createdAt: (template as any).createdAt,
        updatedAt: (template as any).updatedAt,
      },
    };
  }

  async getAppTemplates(appId: string, accountId: string) {
    // Verify app exists and account has access
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    const account = await appRepo.findAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (app.organization_id !== account.organization_id) {
      throw new Error('Unauthorized access to this app');
    }

    // Get all app templates using repository
    const appTemplates = await appTemplateRepository.findByAppId(appId);

    // Get all template details
    const templateIds = appTemplates.map((at) => at.template_id);
    const templates = await prismaRead.template.findMany({
      where: { id: { in: templateIds } },
      select: {
        id: true,
        code: true,
        channel: true,
        category: true,
        subject: true,
        content: true,
        language: true,
        version: true,
        active: true,
        requiredVariables: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const templateMap = new Map(templates.map((t: any) => [t.id, t]));

    return {
      appId,
      templates: appTemplates.map((at: any) => {
        const template = templateMap.get(at.template_id);
        return {
          installationId: at.id,
          status: at.status,
          customizations: at.customizations,
          installationDate: at.installationDate,
          template: {
            id: template?.id,
            code: template?.code,
            channel: template?.channel,
            category: template?.category,
            subject: template?.subject,
            content: template?.content,
            language: template?.language,
            version: template?.version,
            active: template?.active,
            requiredVariables: template?.requiredVariables,
            description: template?.description,
            createdAt: template?.createdAt,
            updatedAt: template?.updatedAt,
          },
        };
      }),
      total: appTemplates.length,
    };
  }

  async getAppNotifications(
    appId: string,
    accountId: string,
    page: number,
    limit: number,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    // Verify app exists and account has access
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    const account = await appRepo.findAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (app.organization_id !== account.organization_id) {
      throw new Error('Unauthorized access to this app');
    }

    // Build where clause for notifications
    const where: any = { app_id: appId };
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // Get total count
    const total = await prismaRead.notification.count({ where });

    // Get paginated notifications with logs
    const notificationRecords = await prismaRead.notification.findMany({
      where,
      include: {
        logs: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      appId,
      notifications: notificationRecords.map((n: any) => ({
        id: n.id,
        appId: n.app_id,
        recipient: n.recipient,
        templateCode: n.templateCode,
        channel: n.channel,
        status: n.status,
        timestamp: n.createdAt,
        logs: n.logs.map((l: any) => ({
          id: l.id,
          provider: l.provider,
          status: l.status,
          response: l.response,
          timestamp: l.createdAt,
        })),
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export const appService = new AppService();

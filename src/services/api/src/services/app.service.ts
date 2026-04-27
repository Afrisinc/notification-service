import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { AppRepository } from '../repositories/app.repository';
import { appTemplateRepository } from '../repositories/template-installation.repository';
import { TemplateRepository } from '../repositories/template.repository';
import {
  parseTemplateRequest,
  extractHtmlContent,
  extractVariablesFromContent,
  validateDesignJson,
  normalizeEditorType,
} from '../utils/template-parser';
import { prismaRead, prismaWrite } from '@shared/database';

const appRepo = new AppRepository();
const templateRepo = new TemplateRepository();

export interface CreateAppRequest {
  name: string;
  environment: 'production' | 'staging' | 'development';
  description?: string;
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
  async createApp(data: CreateAppRequest, organizationId: string, userId: string): Promise<AppResponse> {
    if (!data.name || !data.environment) {
      throw new Error('Name and environment are required');
    }

    // Get user's account in the organization
    const account = await appRepo.findAccountByUserAndOrganization(userId, organizationId);
    if (!account) {
      throw new Error('User account not found in this organization. Please contact your organization administrator.');
    }

    // Generate unique API key
    const apiKey = `sk_${data.environment}_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    try {
      const app = await appRepo.create({
        account_id: account.id,
        organization_id: organizationId,
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
          accountId: account.id,
          organizationId: organizationId,
          userId,
        },
        'App created successfully'
      );

      return {
        id: app.id,
        account_id: app.account_id,
        organization_id: organizationId,
        name: app.name,
        environment: app.environment,
        api_key: apiKey,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    } catch (error) {
      logger.error({ error, data, organizationId }, 'Failed to create app');
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
      prismaRead.notification.count({ where: { app_id: appId } }),
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

  async getAppByOrganization(appId: string, organizationId: string): Promise<AppResponse> {
    const app = await appRepo.findById(appId);

    if (!app) {
      throw new Error('App not found');
    }

    // Verify app belongs to the specified organization
    // Handle legacy apps where organization_id might be null by checking account's organization
    if (app.organization_id && app.organization_id !== organizationId) {
      throw new Error('Unauthorized: App does not belong to this organization');
    }

    if (!app.organization_id) {
      // Legacy app - verify account belongs to the organization
      const account = await appRepo.findAccountById(app.account_id);
      if (account?.organization_id !== organizationId) {
        throw new Error('Unauthorized: App does not belong to this organization');
      }
    }

    const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
      prismaRead.appTemplate.count({ where: { app_id: appId } }),
      prismaRead.notification.count({ where: { app_id: appId } }),
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
    // Get account to find its organization
    const account = await appRepo.findAccountById(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.organization_id) {
      throw new Error('Account is not associated with an organization');
    }

    // Fetch all apps for the organization to ensure all members see all org apps
    const apps = await appRepo.findByOrganizationId(account.organization_id);

    const enrichedApps: AppResponse[] = [];

    for (const app of apps) {
      const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
        prismaRead.appTemplate.count({ where: { app_id: app.id } }),
        prismaRead.notification.count({ where: { app_id: app.id } }),
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
    organizationId: string,
    data: Partial<{ name: string; environment: string; status: string }>
  ): Promise<AppResponse> {
    const app = await appRepo.findById(appId);

    if (!app) {
      throw new Error('App not found');
    }

    // Verify app belongs to the specified organization
    if (app.organization_id && app.organization_id !== organizationId) {
      throw new Error('Unauthorized: App does not belong to this organization');
    }

    if (!app.organization_id) {
      // Legacy app - verify account belongs to the organization
      const account = await appRepo.findAccountById(app.account_id);
      if (account?.organization_id !== organizationId) {
        throw new Error('Unauthorized: App does not belong to this organization');
      }
    }

    const updated = await appRepo.update(appId, data);

    logger.info({ organizationId, appId, changes: data }, 'App updated');

    return {
      id: updated.id,
      account_id: updated.account_id,
      organization_id: updated.organization_id || undefined,
      name: updated.name,
      environment: updated.environment,
      api_key: updated.api_key,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteApp(appId: string, organizationId: string): Promise<void> {
    const app = await appRepo.findById(appId);

    if (!app) {
      throw new Error('App not found');
    }

    // Verify app belongs to the specified organization
    if (app.organization_id && app.organization_id !== organizationId) {
      throw new Error('Unauthorized: App does not belong to this organization');
    }

    if (!app.organization_id) {
      // Legacy app - verify account belongs to the organization
      const account = await appRepo.findAccountById(app.account_id);
      if (account?.organization_id !== organizationId) {
        throw new Error('Unauthorized: App does not belong to this organization');
      }
    }

    await appRepo.delete(appId);

    logger.info({ organizationId, appId }, 'App deleted');
  }

  async rotateApiKey(appId: string, organizationId: string): Promise<string> {
    const app = await appRepo.findById(appId);

    if (!app) {
      throw new Error('App not found');
    }

    // Verify app belongs to the specified organization
    if (app.organization_id && app.organization_id !== organizationId) {
      throw new Error('Unauthorized: App does not belong to this organization');
    }

    if (!app.organization_id) {
      // Legacy app - verify account belongs to the organization
      const account = await appRepo.findAccountById(app.account_id);
      if (account?.organization_id !== organizationId) {
        throw new Error('Unauthorized: App does not belong to this organization');
      }
    }

    const newApiKey = `sk_${app.environment}_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    await appRepo.update(appId, { api_key: newApiKey });

    logger.info({ organizationId, appId }, 'API key rotated');

    return newApiKey;
  }

  async getAppsByOrganization(organizationId: string): Promise<AppResponse[]> {
    // Get apps directly from organization
    const apps = await appRepo.findByOrganizationId(organizationId);

    const enrichedApps: AppResponse[] = [];

    for (const app of apps) {
      const [templateCount, notificationCount, apiKeyCount] = await prismaRead.$transaction([
        prismaRead.appTemplate.count({ where: { app_id: app.id } }),
        prismaRead.notification.count({ where: { app_id: app.id } }),
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

    return enrichedApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAppsByOrganizationDetails(organizationId: string, search?: string) {
    // Get apps directly from organization with template counts
    let apps = await appRepo.findByOrganizationId(organizationId);

    // Filter by search term (case-insensitive) if provided
    if (search) {
      const searchLower = search.toLowerCase();
      apps = apps.filter((app) => app.name.toLowerCase().includes(searchLower));
    }

    const enrichedApps = [];

    for (const app of apps) {
      const [templateCount, templatesSentCount] = await prismaRead.$transaction([
        prismaRead.appTemplate.count({ where: { app_id: app.id } }),
        prismaRead.notification.count({ where: { app_id: app.id, templateId: { not: null } } }),
      ]);

      enrichedApps.push({
        id: app.id,
        name: app.name,
        environment: app.environment,
        status: app.status,
        createdAt: app.createdAt,
        templateCount,
        templatesSent: templatesSentCount,
      });
    }

    return enrichedApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAppTemplate(appId: string, organizationId: string, userId: string, data: any) {
    // Verify app exists and belongs to organization
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    console.log('App details:', app, organizationId);

    // Verify app belongs to the specified organization
    let appBelongsToOrg = false;

    if (app.organization_id) {
      appBelongsToOrg = app.organization_id === organizationId;
    } else {
      const appAccount = await appRepo.findAccountById(app.account_id);
      console.log('App account details:', appAccount);
      appBelongsToOrg = appAccount?.organization_id === organizationId;
    }

    if (!appBelongsToOrg) {
      throw new Error('Unauthorized access to this app');
    }

    // Get user's account in the organization for template creation
    // This allows any organization member to create templates under their own account
    const account = await appRepo.findAccountByUserAndOrganization(userId, organizationId);
    if (!account) {
      throw new Error('User account not found in this organization. Please contact your organization administrator.');
    }

    // Handle two cases: install existing template OR create new template
    let templateId: string;
    let template: any;

    // Provide default language if not specified
    if (!data.language) {
      data.language = 'en';
    }

    if (data.template_id) {
      // Case 1: Install existing template
      templateId = data.template_id;

      // Verify template exists
      template = await prismaRead.template.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Check if template is already installed
      const existingInstallation = await appTemplateRepository.findByAppAndTemplate(appId, templateId);
      if (existingInstallation) {
        throw new Error('Template already installed on this app');
      }
    } else if (data.code && data.channel && data.content && data.language) {
      // Case 2: Create new template for the account using repository
      try {
        // Parse and validate template request data
        const parsedData = parseTemplateRequest(data);

        const newTemplate = await templateRepo.create(account.id, parsedData, userId);

        templateId = newTemplate.id;
        template = newTemplate;

        logger.info(
          {
            appId,
            templateId,
            templateCode: data.code,
            accountId: account.id,
            organizationId,
          },
          'New template created for account'
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a duplicate template error
        if (errorMessage.includes('already exists') && errorMessage.includes('code')) {
          throw new Error(
            `Template with code "${data.code}" for ${data.channel} in ${data.language} language already exists. ` +
              `Please use a different code or delete the existing template first.`
          );
        }

        throw error;
      }
    } else {
      throw new Error('Either template_id or (code, channel, content, language) must be provided');
    }

    // Create app template installation
    const appTemplate = await appTemplateRepository.create({
      app_id: appId,
      template_id: templateId,
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
            design_json: true,
            editor_type: true,
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
        templateId,
        templateCode: template.code,
        mode: data.template_id ? 'install' : 'create',
      },
      'Template created/installed on app'
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
        design_json: (installation as any).template.design_json,
        editor_type: (installation as any).template.editor_type,
        description: (installation as any).template.description,
        createdAt: (installation as any).template.createdAt,
        updatedAt: (installation as any).template.updatedAt,
      },
    };
  }

  async getAppTemplateById(appId: string, templateId: string, organizationId: string) {
    // Verify app exists and belongs to organization
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    if (app.organization_id !== organizationId) {
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
        design_json: true,
        editor_type: true,
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
        design_json: (template as any).design_json,
        editor_type: (template as any).editor_type,
        description: (template as any).description,
        createdAt: (template as any).createdAt,
        updatedAt: (template as any).updatedAt,
      },
    };
  }

  async getAppTemplates(appId: string, organizationId: string) {
    // Verify app exists and belongs to organization
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    if (app.organization_id !== organizationId) {
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

  async updateAppTemplate(appId: string, templateId: string, organizationId: string, data: any) {
    // Verify app exists and belongs to organization
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    if (app.organization_id !== organizationId) {
      throw new Error('Unauthorized access to this app');
    }

    // Get the app template
    const appTemplate = await appTemplateRepository.findByAppAndTemplate(appId, templateId);
    if (!appTemplate) {
      throw new Error('Template not found on this app');
    }

    // Get the current template
    const currentTemplate = await prismaRead.template.findUnique({
      where: { id: templateId },
    });

    if (!currentTemplate) {
      throw new Error('Template not found');
    }

    // Parse and prepare update data
    const updateData: any = {};

    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.content !== undefined) {
      // Clean content and extract variables
      const cleanContent = extractHtmlContent(data.content);
      const variables = extractVariablesFromContent(cleanContent);

      updateData.content = cleanContent;
      updateData.requiredVariables = variables;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.design_json !== undefined) {
      updateData.design_json = validateDesignJson(data.design_json);
    }
    if (data.editor_type !== undefined) {
      updateData.editor_type = normalizeEditorType(data.editor_type);
    }
    if (data.code !== undefined) updateData.code = data.code;
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.language !== undefined) updateData.language = data.language;

    // Update template version on any change
    if (Object.keys(updateData).length > 0) {
      updateData.version = (currentTemplate.version || 0) + 1;

      const updated = await prismaWrite.template.update({
        where: { id: templateId },
        data: updateData,
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
          design_json: true,
          editor_type: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ templateId, appId, version: updated.version }, 'Template updated');

      return {
        installationId: appTemplate.id,
        appId,
        status: appTemplate.status,
        template: updated,
      };
    }

    // No changes
    return {
      installationId: appTemplate.id,
      appId,
      status: appTemplate.status,
      template: currentTemplate,
    };
  }

  async deleteAppTemplate(appId: string, templateId: string, organizationId: string, userId: string) {
    // Verify app exists and belongs to organization
    const app = await appRepo.findById(appId);
    if (!app) {
      throw new Error('App not found');
    }

    if (app.organization_id !== organizationId) {
      throw new Error('Unauthorized access to this app');
    }

    // Get the template to verify ownership
    const template = await prismaRead.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Verify user owns this template (created_by_user_id matches)
    if (template.created_by_user_id !== userId) {
      throw new Error('Only the template creator can delete it');
    }

    // Get the app template installation
    const appTemplate = await appTemplateRepository.findByAppAndTemplate(appId, templateId);
    if (!appTemplate) {
      throw new Error('Template not found on this app');
    }

    // Delete the app template installation
    await appTemplateRepository.delete(appTemplate.id);

    logger.info({ appId, templateId, userId }, 'App template deleted');

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }
}

export const appService = new AppService();

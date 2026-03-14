export const AppResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'App ID' },
    account_id: { type: 'string', description: 'Account ID' },
    organization_id: { type: 'string', description: 'Organization ID', nullable: true },
    name: { type: 'string', description: 'App name' },
    environment: { type: 'string', enum: ['production', 'staging', 'development'], description: 'App environment' },
    api_key: { type: 'string', description: 'API key (secret)' },
    status: { type: 'string', description: 'App status' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation date' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' },
    templateCount: { type: 'number', description: 'Number of templates' },
    notificationsSent: { type: 'number', description: 'Total notifications sent' },
    apiKeyCount: { type: 'number', description: 'Total API keys for this app' },
  },
  required: [
    'id',
    'account_id',
    'name',
    'environment',
    'api_key',
    'status',
    'createdAt',
    'updatedAt',
    'templateCount',
    'notificationsSent',
    'apiKeyCount',
  ],
} as const;

export const CreateAppResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App created successfully' },
    resp_code: { type: 'number', example: 2001 },
    data: AppResponseSchema,
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const GetAppResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App retrieved successfully' },
    resp_code: { type: 'number', example: 2002 },
    data: AppResponseSchema,
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const ListAppsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Apps retrieved successfully' },
    resp_code: { type: 'number', example: 2003 },
    data: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account ID' },
        apps: {
          type: 'array',
          items: AppResponseSchema,
          description: 'List of applications',
        },
        total: { type: 'number', description: 'Total number of apps' },
      },
      required: ['apps', 'total'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const UpdateAppResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App updated successfully' },
    resp_code: { type: 'number', example: 2004 },
    data: AppResponseSchema,
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const DeleteAppResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App deleted successfully' },
    resp_code: { type: 'number', example: 2005 },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deleted app ID' },
      },
      required: ['id'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const RotateApiKeyResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'API key rotated successfully' },
    resp_code: { type: 'number', example: 2006 },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'App ID' },
        api_key: { type: 'string', description: 'New API key' },
      },
      required: ['id', 'api_key'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const AppWithMetricsResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'App ID' },
    account_id: { type: 'string', description: 'Account ID' },
    organization_id: { type: 'string', description: 'Organization ID', nullable: true },
    name: { type: 'string', description: 'App name' },
    environment: { type: 'string', enum: ['production', 'staging', 'development'], description: 'App environment' },
    api_key: { type: 'string', description: 'API key (secret)' },
    status: { type: 'string', description: 'App status' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation date' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' },
    templateCount: { type: 'number', description: 'Number of templates' },
    notificationsSent: { type: 'number', description: 'Total notifications sent' },
    apiKeyCount: { type: 'number', description: 'Total API keys for this app' },
  },
  required: [
    'id',
    'account_id',
    'name',
    'environment',
    'api_key',
    'status',
    'createdAt',
    'updatedAt',
    'templateCount',
    'notificationsSent',
    'apiKeyCount',
  ],
} as const;

export const GetAppsByOrganizationResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Organization apps retrieved successfully' },
    resp_code: { type: 'number', example: 2007 },
    data: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', description: 'Organization ID' },
        apps: {
          type: 'array',
          items: AppWithMetricsResponseSchema,
          description: 'List of applications with metrics',
        },
        total: { type: 'number', description: 'Total number of apps' },
      },
      required: ['organization_id', 'apps', 'total'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const CreateAppTemplateResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Template installed on app successfully' },
    resp_code: { type: 'number', example: 2010 },
    data: {
      type: 'object',
      properties: {
        installationId: { type: 'string', description: 'App template installation ID' },
        appId: { type: 'string', description: 'App ID' },
        status: { type: 'string', enum: ['active', 'archived', 'disabled'], description: 'Installation status' },
        customizations: { type: 'object', description: 'Custom overrides for this installation' },
        installationDate: { type: 'string', format: 'date-time', description: 'When template was installed' },
        template: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Template ID' },
            code: { type: 'string', description: 'Template code' },
            channel: { type: 'string', enum: ['email', 'sms', 'push', 'in-app'], description: 'Notification channel' },
            category: { type: 'string', description: 'Template category' },
            subject: { type: 'string', description: 'Email subject' },
            content: { type: 'string', description: 'Template content' },
            language: { type: 'string', description: 'Template language' },
            version: { type: 'number', description: 'Template version' },
            active: { type: 'boolean', description: 'Is template active' },
            requiredVariables: { type: 'object', description: 'Required variables for rendering' },
            description: { type: 'string', description: 'Template description' },
            createdAt: { type: 'string', format: 'date-time', description: 'Template creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Template last update' },
          },
          required: ['id', 'code', 'channel', 'content'],
        },
      },
      required: ['installationId', 'appId', 'status', 'template'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const GetAppTemplateByIdResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App template retrieved successfully' },
    resp_code: { type: 'number', example: 2009 },
    data: {
      type: 'object',
      properties: {
        installationId: { type: 'string', description: 'App template installation ID' },
        appId: { type: 'string', description: 'App ID' },
        status: { type: 'string', enum: ['active', 'archived', 'disabled'], description: 'Installation status' },
        customizations: { type: 'object', description: 'Custom overrides for this installation' },
        installationDate: { type: 'string', format: 'date-time', description: 'When template was installed' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update of installation' },
        template: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Template ID' },
            code: { type: 'string', description: 'Template code' },
            channel: { type: 'string', enum: ['email', 'sms', 'push', 'in-app'], description: 'Notification channel' },
            category: { type: 'string', description: 'Template category' },
            subject: { type: 'string', description: 'Email subject' },
            content: { type: 'string', description: 'Template content' },
            language: { type: 'string', description: 'Template language' },
            version: { type: 'number', description: 'Template version' },
            active: { type: 'boolean', description: 'Is template active' },
            requiredVariables: { type: 'object', description: 'Required variables for rendering' },
            description: { type: 'string', description: 'Template description' },
            createdAt: { type: 'string', format: 'date-time', description: 'Template creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Template last update' },
          },
          required: ['id', 'code', 'channel', 'content'],
        },
      },
      required: ['installationId', 'appId', 'status', 'template'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const GetAppTemplatesResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'App templates retrieved successfully' },
    resp_code: { type: 'number', example: 2008 },
    data: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        templates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              installationId: { type: 'string', description: 'App template installation ID' },
              status: { type: 'string', enum: ['active', 'archived', 'disabled'], description: 'Installation status' },
              customizations: { type: 'object', description: 'Custom overrides for this installation' },
              installationDate: { type: 'string', format: 'date-time', description: 'When template was installed' },
              template: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Template ID' },
                  code: { type: 'string', description: 'Template code' },
                  channel: {
                    type: 'string',
                    enum: ['email', 'sms', 'push', 'in-app'],
                    description: 'Notification channel',
                  },
                  category: { type: 'string', description: 'Template category' },
                  subject: { type: 'string', description: 'Email subject' },
                  content: { type: 'string', description: 'Template content' },
                  language: { type: 'string', description: 'Template language' },
                  version: { type: 'number', description: 'Template version' },
                  active: { type: 'boolean', description: 'Is template active' },
                  requiredVariables: { type: 'object', description: 'Required variables for rendering' },
                  description: { type: 'string', description: 'Template description' },
                  createdAt: { type: 'string', format: 'date-time', description: 'Template creation date' },
                  updatedAt: { type: 'string', format: 'date-time', description: 'Template last update' },
                },
                required: ['id', 'code', 'channel', 'content'],
              },
            },
            required: ['installationId', 'status', 'template'],
          },
          description: 'List of installed templates with details',
        },
        total: { type: 'number', description: 'Total number of templates' },
      },
      required: ['appId', 'templates', 'total'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const GetAppNotificationsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Notifications retrieved successfully' },
    resp_code: { type: 'number', example: 2008 },
    data: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'App ID' },
        notifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Notification ID' },
              appId: { type: 'string', description: 'App ID' },
              recipient: { type: 'string', description: 'Recipient email/phone/user ID' },
              templateCode: { type: 'string', description: 'Template code' },
              channel: {
                type: 'string',
                enum: ['email', 'sms', 'push', 'in-app'],
                description: 'Notification channel',
              },
              status: {
                type: 'string',
                enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'],
                description: 'Notification status',
              },
              timestamp: { type: 'string', format: 'date-time', description: 'Notification timestamp' },
              logs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Log ID' },
                    provider: { type: 'string', description: 'Provider name' },
                    status: { type: 'string', description: 'Log status' },
                    response: { type: 'object', description: 'Provider response' },
                    timestamp: { type: 'string', format: 'date-time', description: 'Log timestamp' },
                  },
                },
                description: 'Delivery logs from providers',
              },
            },
            required: ['id', 'appId', 'recipient', 'templateCode', 'channel', 'status', 'timestamp'],
          },
          description: 'List of notifications with delivery logs',
        },
        total: { type: 'number', description: 'Total number of notifications' },
        page: { type: 'number', description: 'Current page' },
        limit: { type: 'number', description: 'Items per page' },
        totalPages: { type: 'number', description: 'Total number of pages' },
      },
      required: ['appId', 'notifications', 'total', 'page', 'limit', 'totalPages'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

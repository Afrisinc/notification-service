export const GetAppSettingsSchema = {
  tags: ['App Settings'],
  summary: 'Get app settings',
  description: 'Retrieve all settings for an application',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
    },
    required: ['appId'],
  },
  response: {
    200: {
      description: 'Settings retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
            name: { type: 'string', description: 'App name' },
            environment: { type: 'string', description: 'Environment (development, staging, production)' },
            status: { type: 'string', description: 'App status (active, inactive, archived)' },
            description: { type: 'string', description: 'App description' },
            allowedDomains: { type: 'array', items: { type: 'string' }, description: 'Allowed domain URLs' },
            createdAt: { type: 'string', description: 'Creation timestamp' },
            updatedAt: { type: 'string', description: 'Last update timestamp' },
          },
        },
      },
    },
  },
};

export const UpdateAppSettingsSchema = {
  tags: ['App Settings'],
  summary: 'Update app settings',
  description: 'Update app description and other general settings',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      description: { type: 'string', maxLength: 500, description: 'App description' },
    },
  },
  response: {
    200: {
      type: 'object',
      description: 'Settings updated successfully',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const UpdateAllowedDomainsSchema = {
  tags: ['App Settings'],
  summary: 'Update allowed domains',
  description: 'Configure domains allowed to access the app API (CORS/security)',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      allowedDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of allowed domain URLs',
      },
    },
    required: ['allowedDomains'],
  },
};

export const ListWebhooksSchema = {
  tags: ['Webhooks'],
  summary: 'List webhooks',
  description: 'Retrieve all configured webhooks for the app',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
    },
    required: ['appId'],
  },
};

export const CreateWebhookSchema = {
  tags: ['Webhooks'],
  summary: 'Create webhook',
  description: 'Configure a new webhook endpoint for delivery events',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Webhook endpoint URL (must be HTTPS)' },
      events: {
        type: 'array',
        items: { type: 'string' },
        description: 'Events to subscribe to',
      },
      headers: { type: 'object', description: 'Custom HTTP headers', additionalProperties: { type: 'string' } },
      isActive: { type: 'boolean', description: 'Enable/disable webhook' },
      maxRetries: { type: 'number', description: 'Max retry attempts' },
      retryDelay: { type: 'number', description: 'Delay between retries in seconds' },
      backoffMultiplier: { type: 'number', description: 'Exponential backoff multiplier' },
    },
    required: ['url', 'events'],
  },
};

export const UpdateWebhookSchema = {
  tags: ['Webhooks'],
  summary: 'Update webhook',
  description: 'Update webhook configuration',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
      webhookId: { type: 'string', description: 'Webhook ID' },
    },
    required: ['appId', 'webhookId'],
  },
  body: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      headers: { type: 'object', additionalProperties: { type: 'string' } },
      isActive: { type: 'boolean' },
      maxRetries: { type: 'number' },
      retryDelay: { type: 'number' },
      backoffMultiplier: { type: 'number' },
    },
  },
};

export const DeleteWebhookSchema = {
  tags: ['Webhooks'],
  summary: 'Delete webhook',
  description: 'Remove a webhook endpoint',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
      webhookId: { type: 'string', description: 'Webhook ID' },
    },
    required: ['appId', 'webhookId'],
  },
};

export const TestWebhookSchema = {
  tags: ['Webhooks'],
  summary: 'Test webhook',
  description: 'Send a test webhook event to verify configuration',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
      webhookId: { type: 'string', description: 'Webhook ID' },
    },
    required: ['appId', 'webhookId'],
  },
  body: {
    type: 'object',
    properties: {
      event: { type: 'string', description: 'Event type to test' },
    },
    required: ['event'],
  },
};

export const GetWebhookLogsSchema = {
  tags: ['Webhooks'],
  summary: 'Get webhook logs',
  description: 'Retrieve delivery history for a webhook',
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', description: 'App ID' },
      webhookId: { type: 'string', description: 'Webhook ID' },
    },
    required: ['appId', 'webhookId'],
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number' },
      limit: { type: 'number', description: 'Items per page' },
      status: { type: 'string', description: 'Filter by status (success, failed, pending)' },
    },
  },
};

/**
 * Application Management Route Schemas
 * Validation schemas for application CRUD operations and template management
 */

export const CreateAppTemplateRouteSchema = {
  description: 'Create new template or install existing template on app',
  tags: ['Applications', 'Templates'],
  params: {
    type: 'object',
    properties: {
      appId: {
        type: 'string',
        description: 'Application ID',
      },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'Template ID to install from global templates (use this OR create new)',
      },
      customizations: {
        type: 'object',
        description: 'Custom overrides for this installation (optional)',
      },
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[A-Z_]+$',
        description: 'Unique template code (uppercase with underscores)',
      },
      channel: {
        type: 'string',
        enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
        description: 'Notification channel type',
      },
      subject: {
        type: 'string',
        description: 'Email subject line (optional, required for EMAIL channel)',
      },
      content: {
        type: 'string',
        minLength: 1,
        description: 'Template content with {{variable}} placeholders for dynamic values',
      },
      language: {
        type: 'string',
        minLength: 2,
        maxLength: 5,
        description: 'Language code (ISO 639-1 format, e.g., en, fr, es)',
      },
      description: {
        type: 'string',
        description: 'Template description and usage notes (optional)',
      },
      is_public: {
        type: 'boolean',
        description: 'Whether template is publicly available (default: false)',
      },
      visibility: {
        type: 'string',
        enum: ['private', 'public'],
        description: 'Template visibility scope (default: private)',
      },
      design_json: {
        type: 'object',
        description: 'Template design configuration (layout, styling, blocks, editor state, etc.)',
      },
      editor_type: {
        type: 'string',
        enum: ['visual', 'code'],
        description: 'Template editor type: visual (drag-drop) or code (HTML only)',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            installationId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for this template installation',
            },
            appId: {
              type: 'string',
              format: 'uuid',
              description: 'Application ID',
            },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'disabled'],
              description: 'Current installation status',
            },
            customizations: {
              type: 'object',
              description: 'Custom configuration overrides for this installation',
            },
            installationDate: {
              type: 'string',
              format: 'date-time',
              description: 'When the template was installed on this app',
            },
            template: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Template ID',
                },
                code: {
                  type: 'string',
                  description: 'Template code identifier',
                },
                channel: {
                  type: 'string',
                  enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
                  description: 'Notification channel',
                },
                category: {
                  type: 'string',
                  enum: ['AUTH', 'TRANSACTIONAL', 'MARKETING', 'NOTIFICATION'],
                  description: 'Template category for organization',
                },
                subject: {
                  type: 'string',
                  description: 'Email subject (for EMAIL channel)',
                },
                content: {
                  type: 'string',
                  description: 'Template content with variable placeholders',
                },
                language: {
                  type: 'string',
                  description: 'Template language code',
                },
                version: {
                  type: 'integer',
                  description: 'Current template version',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether template is active',
                },
                requiredVariables: {
                  type: 'array',
                  description: 'Variables required for template rendering',
                },
                design_json: {
                  type: 'object',
                  description: 'Template design configuration (layout, styling, blocks, editor state, etc.)',
                },
                editor_type: {
                  type: 'string',
                  enum: ['visual', 'code'],
                  description: 'Template editor type: visual (drag-drop) or code (HTML only)',
                },
                description: {
                  type: 'string',
                  description: 'Template description',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Template creation timestamp',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last update timestamp',
                },
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    409: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: {
          type: 'string',
          description: 'Duplicate template error when code already exists for this account',
        },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const GetAppsByOrganizationDetailsSchema = {
  description: 'Get applications by organization with details only (no metrics)',
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
    },
    required: ['orgId'],
  },
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search apps by name (case-insensitive)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            organization_id: { type: 'string', description: 'Organization ID' },
            apps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'App ID' },
                  name: { type: 'string', description: 'App name' },
                  environment: { type: 'string', enum: ['production', 'staging', 'development'], description: 'Environment' },
                  status: { type: 'string', description: 'App status' },
                  createdAt: { type: 'string', format: 'date-time', description: 'Creation date' },
                  templateCount: { type: 'integer', description: 'Number of templates for this app' },
                  templatesSent: { type: 'integer', description: 'Number of templates sent via this app' },
                },
                required: ['id', 'name', 'environment', 'status', 'createdAt', 'templateCount', 'templatesSent'],
              },
              description: 'List of apps in the organization',
            },
            total: { type: 'integer', description: 'Total number of apps' },
          },
        },
      },
    },
  },
  tags: ['Applications', 'Organizations'],
  summary: 'Get organization apps (details only)',
};

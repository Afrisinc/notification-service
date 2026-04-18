import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

export const GetEmailProviderSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Get current email provider configuration',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            provider: { type: 'string', enum: ['gmail', 'sendgrid', 'notify', 'custom_domain'] },
            method: { type: 'string', enum: ['oauth2', 'app_password'] },
            isActive: { type: 'boolean' },
            fromEmail: { type: 'string' },
            fromName: { type: 'string' },
            gmailEmail: { type: 'string' },
            oauthTokenExpiry: { type: 'string' },
            domain: { type: 'string' },
            domainStatus: { type: 'string' },
            spfVerified: { type: 'boolean' },
            dkimVerified: { type: 'boolean' },
            dmarcVerified: { type: 'boolean' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const SetSimpleConfigSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Set simple sender configuration',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  body: {
    type: 'object',
    required: ['fromEmail'],
    properties: {
      fromEmail: { type: 'string', description: 'Sender email address' },
      fromName: { type: 'string', description: 'Sender display name' },
      replyToEmail: { type: 'string', description: 'Reply-to email address' },
      replyToName: { type: 'string', description: 'Reply-to display name' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            method: { type: 'string' },
            fromEmail: { type: 'string' },
            fromName: { type: 'string' },
          },
        },
      },
    },
  },
};

export const GetGmailOAuthUrlSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Get Google OAuth2 authorization URL',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            state: { type: 'string' },
          },
        },
      },
    },
  },
};

export const SaveGmailOAuthCallbackSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Exchange OAuth2 code for access tokens',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  body: {
    type: 'object',
    required: ['code', 'state'],
    properties: {
      code: { type: 'string', description: 'Authorization code from Google' },
      state: { type: 'string', description: 'State token for CSRF verification' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            method: { type: 'string' },
            gmailEmail: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
  },
};

export const SetGmailAppPasswordSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Set Gmail app password configuration',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  body: {
    type: 'object',
    required: ['email', 'appPassword'],
    properties: {
      email: { type: 'string', description: 'Gmail email address' },
      appPassword: { type: 'string', description: '16-character app password' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            method: { type: 'string' },
            gmailEmail: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
  },
};

export const ResetEmailProviderSchema: FastifySchema = {
  tags: ['Email Provider'],
  description: 'Reset to default email provider',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string', description: 'App ID (UUID)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
      },
    },
  },
};

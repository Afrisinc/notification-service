import { FastifySchema } from 'fastify';

export const GetEmailConfigSchema: FastifySchema = {
  tags: ['App Email Configuration'],
  description: 'Get email configuration for an app',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: {
        type: 'string',
        description: 'App ID (UUID)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            fromEmail: {
              type: 'string',
              description: 'Sender email address',
            },
            fromName: {
              type: 'string',
              nullable: true,
              description: 'Sender display name',
            },
            replyToEmail: {
              type: 'string',
              nullable: true,
              description: 'Reply-to email address',
            },
            replyToName: {
              type: 'string',
              nullable: true,
              description: 'Reply-to display name',
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether email is verified with SendGrid',
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

export const SetEmailConfigSchema: FastifySchema = {
  tags: ['App Email Configuration'],
  description: 'Set custom email configuration for an app',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: {
        type: 'string',
        description: 'App ID (UUID)',
      },
    },
  },
  body: {
    type: 'object',
    required: ['fromEmail'],
    properties: {
      fromEmail: {
        type: 'string',
        description: 'Sender email address (required)',
      },
      fromName: {
        type: 'string',
        description: 'Sender display name (optional)',
      },
      replyToEmail: {
        type: 'string',
        description: 'Reply-to email address (optional)',
      },
      replyToName: {
        type: 'string',
        description: 'Reply-to display name (optional)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            fromEmail: { type: 'string' },
            fromName: { type: 'string', nullable: true },
            replyToEmail: { type: 'string', nullable: true },
            replyToName: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

export const ResetEmailConfigSchema: FastifySchema = {
  tags: ['App Email Configuration'],
  description: 'Reset email configuration to platform default',
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: {
        type: 'string',
        description: 'App ID',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  },
};

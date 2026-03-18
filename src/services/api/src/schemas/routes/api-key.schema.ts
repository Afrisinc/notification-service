export const CreateApiKeySchema = {
  description: 'Create a new API key for app',
  tags: ['API Keys'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'App ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'API key name/label',
      },
      type: {
        type: 'string',
        enum: ['test', 'production'],
        default: 'test',
        description: 'API key type: test (development) or production',
      },
    },
    required: ['name'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            plainKey: {
              type: 'string',
              description: 'Plain API key (returned only once, must be saved)',
            },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['test', 'production'],
              description: 'API key type',
            },
            createdAt: { type: 'string', format: 'date-time' },
            message: { type: 'string' },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const ListApiKeysSchema = {
  description: 'List API keys for app',
  tags: ['API Keys'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'App ID' },
    },
    required: ['appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      includeRevoked: {
        type: 'boolean',
        default: false,
        description: 'Include revoked keys',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            appId: { type: 'string', format: 'uuid' },
            keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ['test', 'production'],
                  },
                  revoked: { type: 'boolean' },
                  lastUsedAt: { type: 'string', format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            total: { type: 'integer' },
          },
        },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const GetApiKeySchema = {
  description: 'Get API key details',
  tags: ['API Keys'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'App ID' },
      keyId: { type: 'string', format: 'uuid', description: 'API Key ID' },
    },
    required: ['appId', 'keyId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['test', 'production'],
            },
            revoked: { type: 'boolean' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const RevokeApiKeySchema = {
  description: 'Revoke an API key',
  tags: ['API Keys'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'App ID' },
      keyId: { type: 'string', format: 'uuid', description: 'API Key ID' },
    },
    required: ['appId', 'keyId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            revoked: { type: 'boolean' },
            revokedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

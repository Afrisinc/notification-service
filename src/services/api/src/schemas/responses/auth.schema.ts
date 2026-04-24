export const RegisterResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'User registered successfully' },
    resp_code: { type: 'number', example: 1001 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        account_id: { type: 'string', description: 'Individual account ID' },
        email: { type: 'string', description: 'User email' },
        token: { type: 'string', description: 'JWT authentication token' },
      },
      required: ['user_id', 'account_id', 'email', 'token'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const LoginResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Login successful' },
    resp_code: { type: 'number', example: 1000 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        email: { type: 'string', description: 'User email' },
        account_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of account IDs user owns',
        },
        token: { type: 'string', description: 'JWT authentication token (base token)' },
        token_type: { type: 'string', example: 'Bearer', description: 'Token type' },
        expires_in: { type: 'number', example: 604800, description: 'Token expiration time in seconds' },
      },
      required: ['user_id', 'email', 'account_ids', 'token', 'token_type', 'expires_in'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const OAuthExchangeResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Token issued successfully' },
    resp_code: { type: 'number', example: 2000 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        email: { type: 'string', description: 'User email' },
        account_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of account IDs user owns',
        },
        token: { type: 'string', description: 'JWT authentication token (base token)' },
        token_type: { type: 'string', example: 'Bearer', description: 'Token type' },
        expires_in: { type: 'number', example: 604800, description: 'Token expiration time in seconds' },
      },
      required: ['user_id', 'email', 'account_ids', 'token', 'token_type', 'expires_in'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const ForgotPasswordResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: {
      type: 'string',
      example: 'Reset password email sent successfully',
    },
    resp_code: { type: 'number', example: 1002 },
    data: {
      type: 'object',
      properties: {
        resetLink: { type: 'string' },
      },
      required: ['resetLink'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const ResetPasswordResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Password reset successfully' },
    resp_code: { type: 'number', example: 1003 },
    data: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password reset successfully' },
      },
      required: ['message'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const VerifyEmailResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Email verified successfully' },
    resp_code: { type: 'number', example: 1005 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        email: { type: 'string', description: 'Verified email address' },
        message: { type: 'string', example: 'Email verified successfully' },
      },
      required: ['user_id', 'email'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const VerifyResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Token is valid' },
    resp_code: { type: 'number', example: 1004 },
    data: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        user_id: { type: 'string' },
        email: { type: 'string' },
        token_type: { type: 'string', description: 'Token type: base or product' },
      },
      required: ['valid', 'user_id', 'email'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const ProfileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Profile retrieved successfully' },
    resp_code: { type: 'number', example: 1006 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        email: { type: 'string', description: 'User email' },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        phone: { type: ['string', 'null'], description: 'Phone number' },
        location: { type: ['string', 'null'], description: 'Location' },
        email_verified: { type: 'boolean', description: 'Email verification status' },
        status: { type: 'string', example: 'ACTIVE', description: 'User status' },
        createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
        accounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Account ID' },
              type: { type: 'string', enum: ['INDIVIDUAL', 'ORGANIZATION'], description: 'Account type' },
              organizationId: { type: ['string', 'null'], description: 'Organization ID if applicable' },
              createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
            },
            required: ['id', 'type', 'createdAt'],
          },
          description: 'List of accounts owned by user',
        },
      },
      required: ['user_id', 'email', 'firstName', 'lastName', 'email_verified', 'status', 'createdAt', 'accounts'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const OrganizationsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'Organizations retrieved successfully' },
    resp_code: { type: 'number', example: 1007 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        organizations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Organization ID or "personal" for personal account' },
              name: { type: 'string', description: 'Organization name' },
              slug: { type: 'string', description: 'Organization slug for URLs' },
              plan: { type: 'string', description: 'Organization subscription plan (e.g., free, pro, enterprise)' },
              userRole: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'], description: 'User role in the organization (OWNER, ADMIN, or MEMBER)' },
              legal_name: { type: ['string', 'null'], description: 'Legal business name' },
              createdAt: { type: 'string', format: 'date-time', description: 'Organization creation date' },
              apps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'App ID' },
                    name: { type: 'string', description: 'App name' },
                    environment: {
                      type: 'string',
                      enum: ['production', 'staging', 'development'],
                      description: 'App environment',
                    },
                    api_key: { type: 'string', description: 'API key' },
                    status: { type: 'string', description: 'App status' },
                    createdAt: { type: 'string', format: 'date-time', description: 'App creation date' },
                  },
                  required: ['id', 'name', 'environment', 'api_key', 'status', 'createdAt'],
                },
                description: 'List of apps in the organization',
              },
            },
            required: ['id', 'name', 'slug', 'plan', 'userRole', 'createdAt', 'apps'],
          },
          description: 'List of organizations and their apps',
        },
      },
      required: ['user_id', 'organizations'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

export const UserAppsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    resp_msg: { type: 'string', example: 'User apps retrieved successfully' },
    resp_code: { type: 'number', example: 1008 },
    data: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        apps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'App ID' },
              orgId: { type: 'string', description: 'Organization ID or "personal"' },
              name: { type: 'string', description: 'App name' },
              environment: {
                type: 'string',
                enum: ['production', 'staging', 'development'],
                description: 'App environment',
              },
              description: { type: ['string', 'null'], description: 'App description' },
              createdAt: { type: 'string', format: 'date-time', description: 'App creation date' },
              templateCount: { type: 'number', description: 'Number of templates for this app' },
              apiKeyCount: { type: 'number', description: 'Number of API keys for the organization' },
              notificationsSent: { type: 'number', description: 'Total notifications sent for the organization' },
            },
            required: [
              'id',
              'orgId',
              'name',
              'environment',
              'createdAt',
              'templateCount',
              'apiKeyCount',
              'notificationsSent',
            ],
          },
          description: 'List of user apps with metrics',
        },
      },
      required: ['user_id', 'apps'],
    },
  },
  required: ['success', 'resp_msg', 'resp_code', 'data'],
} as const;

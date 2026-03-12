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
        code: { type: 'string', description: 'Authorization code (short-lived, 10 minutes)' },
        redirect: { type: 'boolean', description: 'Whether a redirect is required' },
        callback: { type: 'string', description: 'Callback URL with authorization code for OAuth redirect' },
        productCount: { type: 'number', description: 'Number of products user is enrolled in' },
      },
      required: ['user_id', 'email', 'account_ids', 'code', 'redirect', 'callback'],
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

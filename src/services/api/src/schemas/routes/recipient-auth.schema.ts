import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

export const RequestAccessSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Request a mail-portal access link for an email address that has received mail on the platform',
  body: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

export const SetPasswordSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Set the mail-portal password using a bootstrap or reset token',
  body: {
    type: 'object',
    required: ['token', 'password'],
    properties: {
      token: { type: 'string' },
      password: { type: 'string', minLength: 8 },
    },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

export const RecipientLoginSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Log in to the mail portal with email and password',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
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
            token: { type: 'string' },
            email: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
    },
  },
};

export const RecipientForgotPasswordSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Request a mail-portal password reset link',
  body: {
    type: 'object',
    required: ['email'],
    properties: { email: { type: 'string', format: 'email' } },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

export const RecipientResetPasswordSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Reset the mail-portal password using a reset token',
  body: {
    type: 'object',
    required: ['token', 'password'],
    properties: {
      token: { type: 'string' },
      password: { type: 'string', minLength: 8 },
    },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

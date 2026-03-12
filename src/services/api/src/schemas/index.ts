/**
 * Central export point for all API schemas
 *
 * Schema organization:
 * - common/: Shared schemas (errors, pagination, headers)
 * - notify/: Notification endpoint schemas
 * - template/: Template endpoint schemas
 * - requests/: Request schemas
 * - responses/: Response schemas
 *
 * Usage:
 * import { sendNotificationSchema } from '@/schemas';
 * import { createTemplateSchema } from '@/schemas';
 */

// Common schemas (errors, pagination, etc.)
export * from './common';

// Notification schemas
export * from './notify';

// Template schemas
export * from './template';

// Auth request and response schemas
export {
  SignupPayload,
  RegisterRequestSchema,
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  OAuthExchangeRequestSchema,
} from './requests/auth.schema';

export {
  RegisterResponseSchema,
  LoginResponseSchema,
  OAuthExchangeResponseSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordResponseSchema,
  VerifyResponseSchema,
} from './responses/auth.schema';

// Import individual schemas to build route schemas
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  OAuthExchangeRequestSchema,
} from './requests/auth.schema';

import {
  RegisterResponseSchema,
  LoginResponseSchema,
  OAuthExchangeResponseSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordResponseSchema,
  VerifyResponseSchema,
} from './responses/auth.schema';

import { errorResponse } from './common/error-responses';

// Route Schemas (combining request + response)
export const RegisterRouteSchema = {
  body: { ...RegisterRequestSchema },
  response: {
    201: RegisterResponseSchema,
    400: errorResponse,
  },
} as const;

export const LoginRouteSchema = {
  body: { ...LoginRequestSchema },
  response: {
    200: LoginResponseSchema,
    401: errorResponse,
  },
} as const;

export const ForgotPasswordRouteSchema = {
  body: { ...ForgotPasswordRequestSchema },
  response: {
    200: ForgotPasswordResponseSchema,
    404: errorResponse,
  },
} as const;

export const ResetPasswordRouteSchema = {
  body: { ...ResetPasswordRequestSchema },
  querystring: {
    type: 'object',
    properties: {
      token: { type: 'string' },
    },
  },
  response: {
    200: ResetPasswordResponseSchema,
    400: errorResponse,
  },
} as const;

export const VerifyRouteSchema = {
  body: {
    type: 'object',
    properties: {
      token: { type: 'string' },
    },
    required: ['token'],
  },
  response: {
    200: VerifyResponseSchema,
    401: errorResponse,
  },
} as const;

export const OAuthExchangeRouteSchema = {
  body: { ...OAuthExchangeRequestSchema },
  response: {
    200: OAuthExchangeResponseSchema,
    400: errorResponse,
  },
} as const;

// Import common schemas first to resolve dependencies
import { errorResponse } from './common/error-responses';

// Common schemas (errors, pagination, etc.)
export * from './common';

// Notification schemas
export * from './notify';

// Template schemas
export * from './template';

// App request schemas
export { CreateAppRequestSchema, UpdateAppRequestSchema } from './requests/app.schema';

// App response schemas
export {
  AppResponseSchema,
  AppWithMetricsResponseSchema,
  CreateAppResponseSchema,
  GetAppResponseSchema,
  ListAppsResponseSchema,
  UpdateAppResponseSchema,
  DeleteAppResponseSchema,
  RotateApiKeyResponseSchema,
  GetAppsByOrganizationResponseSchema,
  GetAppTemplatesResponseSchema,
  GetAppTemplateByIdResponseSchema,
  CreateAppTemplateResponseSchema,
  GetAppNotificationsResponseSchema,
} from './responses/app.schema';

// Import app schemas to build route schemas
import { CreateAppRequestSchema, UpdateAppRequestSchema } from './requests/app.schema';
import {
  CreateAppResponseSchema,
  GetAppResponseSchema,
  ListAppsResponseSchema,
  UpdateAppResponseSchema,
  DeleteAppResponseSchema,
  RotateApiKeyResponseSchema,
  GetAppsByOrganizationResponseSchema,
} from './responses/app.schema';
import { GetAppByOrganizationParamsSchema } from './routes/app.schema';

// App Route Schemas (combining request + response)
export const CreateAppRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
    },
    required: ['orgId'],
  },
  body: { ...CreateAppRequestSchema },
  response: {
    201: CreateAppResponseSchema,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const ListAppsRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
    },
    required: ['orgId'],
  },
  response: {
    200: ListAppsResponseSchema,
    401: errorResponse,
    403: errorResponse,
  },
} as const;

export const GetAppRouteSchema = {
  params: GetAppByOrganizationParamsSchema,
  response: {
    200: GetAppResponseSchema,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const UpdateAppRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
  },
  body: { ...UpdateAppRequestSchema },
  response: {
    200: UpdateAppResponseSchema,
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const DeleteAppRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
  },
  response: {
    200: DeleteAppResponseSchema,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const RotateApiKeyRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
      appId: { type: 'string', description: 'Application ID' },
    },
    required: ['orgId', 'appId'],
  },
  response: {
    200: RotateApiKeyResponseSchema,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

export const GetAppsByOrgRouteSchema = {
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', description: 'Organization ID' },
    },
    required: ['orgId'],
  },
  response: {
    200: GetAppsByOrganizationResponseSchema,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
  },
} as const;

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
  VerifyEmailResponseSchema,
  VerifyResponseSchema,
  ProfileResponseSchema,
  OrganizationsResponseSchema,
  UserAppsResponseSchema,
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
  VerifyEmailResponseSchema,
  VerifyResponseSchema,
  ProfileResponseSchema,
  OrganizationsResponseSchema,
  UserAppsResponseSchema,
} from './responses/auth.schema';

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
  response: {
    200: ResetPasswordResponseSchema,
    400: errorResponse,
  },
} as const;

export const VerifyEmailRouteSchema = {
  querystring: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Email verification token' },
    },
    required: ['token'],
  },
  response: {
    200: VerifyEmailResponseSchema,
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

export const ProfileRouteSchema = {
  response: {
    200: ProfileResponseSchema,
    401: errorResponse,
  },
} as const;

export const OrganizationsRouteSchema = {
  response: {
    200: OrganizationsResponseSchema,
    401: errorResponse,
  },
} as const;

export const UserAppsRouteSchema = {
  response: {
    200: UserAppsResponseSchema,
    401: errorResponse,
  },
} as const;

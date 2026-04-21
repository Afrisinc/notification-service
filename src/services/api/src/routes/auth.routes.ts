import type { FastifyInstance } from 'fastify';
import {
  exchangeCodeForToken,
  forgotPassword,
  getProfile,
  getOrganizationsByUserId,
  getUserApps,
  loginUser,
  registerUser,
  resetPassword,
  verifyAuth,
  verifyEmail,
  resendVerificationEmail,
} from '../controllers/auth.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import {
  ForgotPasswordRouteSchema,
  LoginRouteSchema,
  RegisterRouteSchema,
  ResetPasswordRouteSchema,
  VerifyEmailRouteSchema,
  VerifyRouteSchema,
  OAuthExchangeRouteSchema,
  ProfileRouteSchema,
  OrganizationsRouteSchema,
  UserAppsRouteSchema,
} from '../schemas';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/resend-verification',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
        tags: ['Authentication'],
        summary: 'Resend verification email',
        description: 'Send a new verification email to the user if they are not verified yet',
      },
    },
    resendVerificationEmail
  );

  app.post(
    '/auth/register',
    {
      schema: {
        ...RegisterRouteSchema,
        tags: ['Authentication'],
        summary: 'Register a new user',
        description: 'Create a new user account with email and password',
      },
    },
    registerUser
  );

  app.post(
    '/auth/login',
    {
      schema: {
        ...LoginRouteSchema,
        tags: ['Authentication'],
        summary: 'Login user',
        description: 'Authenticate user with email and password',
      },
    },
    loginUser
  );

  app.post(
    '/auth/exchange',
    {
      schema: {
        ...OAuthExchangeRouteSchema,
        tags: ['Authentication', 'OAuth'],
        summary: 'Exchange authorization code for token',
        description: 'Exchange OAuth authorization code for access token',
      },
    },
    exchangeCodeForToken
  );

  app.post(
    '/auth/forgot-password',
    {
      schema: {
        ...ForgotPasswordRouteSchema,
        tags: ['Authentication'],
        summary: 'Request password reset',
        description: 'Send password reset email to user',
      },
    },
    forgotPassword
  );

  app.post(
    '/auth/reset-password',
    {
      schema: {
        ...ResetPasswordRouteSchema,
        tags: ['Authentication'],
        summary: 'Reset password',
        description: 'Reset user password with reset token',
      },
    },
    resetPassword
  );

  app.get(
    '/auth/verify-email',
    {
      schema: {
        ...VerifyEmailRouteSchema,
        tags: ['Authentication'],
        summary: 'Verify email address',
        description: 'Verify user email with token',
      },
    },
    verifyEmail
  );

  app.post(
    '/auth/verify',
    {
      schema: {
        ...VerifyRouteSchema,
        tags: ['Authentication'],
        summary: 'Verify token',
        description: 'Verify and validate JWT token',
      },
    },
    verifyAuth
  );

  app.get(
    '/auth/profile',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...ProfileRouteSchema,
        tags: ['Authentication'],
        summary: 'Get user profile',
        description: 'Retrieve authenticated user profile information',
      },
    },
    getProfile
  );

  app.get(
    '/auth/organizations',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...OrganizationsRouteSchema,
        tags: ['Authentication'],
        summary: 'Get user organizations with apps',
        description: 'Retrieve all organizations owned by the user and their associated applications',
      },
    },
    getOrganizationsByUserId
  );

  app.get(
    '/auth/apps',
    {
      onRequest: [validateBaseToken],
      schema: {
        ...UserAppsRouteSchema,
        tags: ['Authentication'],
        summary: 'Get user apps with metrics',
        description:
          'Retrieve all apps owned by the user with detailed metrics including template count, API keys, and notifications sent',
      },
    },
    getUserApps
  );
}

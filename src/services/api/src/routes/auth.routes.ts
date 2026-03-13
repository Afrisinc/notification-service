import type { FastifyInstance } from 'fastify';
import {
  exchangeCodeForToken,
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  verifyAuth,
  verifyEmail,
} from '../controllers/auth.controller';
import {
  ForgotPasswordRouteSchema,
  LoginRouteSchema,
  RegisterRouteSchema,
  ResetPasswordRouteSchema,
  VerifyEmailRouteSchema,
  VerifyRouteSchema,
  OAuthExchangeRouteSchema,
} from '../schemas';

export async function authRoutes(app: FastifyInstance) {
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
    '/oauth/exchange',
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
    '/reset-password',
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
}

import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import * as RecipientAuthController from '../controllers/recipient-auth.controller';
import {
  RequestAccessSchema,
  SetPasswordSchema,
  RecipientLoginSchema,
  RecipientForgotPasswordSchema,
  RecipientResetPasswordSchema,
} from '../schemas/routes/recipient-auth.schema';

/**
 * Auth routes for the recipient mail portal - a separate identity system
 * from business-user auth (see routes/auth.routes.ts), scoped by email
 * address rather than by account.
 */
export async function registerRecipientAuthRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/mail/auth/request-access',
    { schema: RequestAccessSchema },
    asyncWrapper(RecipientAuthController.requestAccess)
  );

  fastify.post(
    '/mail/auth/set-password',
    { schema: SetPasswordSchema },
    asyncWrapper(RecipientAuthController.setPassword)
  );

  fastify.post('/mail/auth/login', { schema: RecipientLoginSchema }, asyncWrapper(RecipientAuthController.login));

  fastify.post(
    '/mail/auth/forgot-password',
    { schema: RecipientForgotPasswordSchema },
    asyncWrapper(RecipientAuthController.forgotPassword)
  );

  fastify.post(
    '/mail/auth/reset-password',
    { schema: RecipientResetPasswordSchema },
    asyncWrapper(RecipientAuthController.resetPassword)
  );
}

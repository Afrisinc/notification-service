import { FastifyInstance } from 'fastify';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import * as EmailProviderController from '../controllers/app-email-provider.controller';
import {
  GetEmailProviderSchema,
  SetSimpleConfigSchema,
  GetGmailOAuthUrlSchema,
  SaveGmailOAuthCallbackSchema,
  SetGmailAppPasswordSchema,
  ResetEmailProviderSchema,
} from '../schemas/routes/app-email-provider.schema';

/**
 * Unified Email Provider Configuration Routes
 * Manage simple, Gmail, and custom domain email configurations
 */
export async function registerAppEmailProviderRoutes(fastify: FastifyInstance) {
  // GET /api/apps/:appId/email-provider
  fastify.get(
    '/apps/:appId/email-provider',
    {
      onRequest: [validateBaseToken],
      schema: GetEmailProviderSchema,
    },
    asyncWrapper(EmailProviderController.getEmailProvider)
  );

  // POST /api/apps/:appId/email-provider/simple
  fastify.post(
    '/apps/:appId/email-provider/simple',
    {
      onRequest: [validateBaseToken],
      schema: SetSimpleConfigSchema,
    },
    asyncWrapper(EmailProviderController.setSimpleConfig)
  );

  // GET /api/apps/:appId/email-provider/gmail/oauth/url
  fastify.get(
    '/apps/:appId/email-provider/gmail/oauth/url',
    {
      onRequest: [validateBaseToken],
      schema: GetGmailOAuthUrlSchema,
    },
    asyncWrapper(EmailProviderController.getGmailOAuthUrl)
  );

  // POST /api/apps/:appId/email-provider/gmail/oauth/callback
  fastify.post(
    '/apps/:appId/email-provider/gmail/oauth/callback',
    {
      onRequest: [validateBaseToken],
      schema: SaveGmailOAuthCallbackSchema,
    },
    asyncWrapper(EmailProviderController.handleGmailOAuthCallback)
  );

  // POST /api/apps/:appId/email-provider/gmail/app-password
  fastify.post(
    '/apps/:appId/email-provider/gmail/app-password',
    {
      onRequest: [validateBaseToken],
      schema: SetGmailAppPasswordSchema,
    },
    asyncWrapper(EmailProviderController.setGmailAppPassword)
  );

  // DELETE /api/apps/:appId/email-provider
  fastify.delete(
    '/apps/:appId/email-provider',
    {
      onRequest: [validateBaseToken],
      schema: ResetEmailProviderSchema,
    },
    asyncWrapper(EmailProviderController.resetEmailProvider)
  );
}

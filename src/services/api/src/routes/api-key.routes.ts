import type { FastifyInstance } from 'fastify';
import { ApiKeyController } from '../controllers/api-key.controller';
import {
  CreateApiKeySchema,
  ListApiKeysSchema,
  GetApiKeySchema,
  RevokeApiKeySchema,
} from '../schemas/routes/api-key.schema';
import { validateBaseToken } from '../middlewares/auth.middleware';

const controller = new ApiKeyController();

export async function apiKeyRoutes(app: FastifyInstance) {
  // Create API key for app
  app.post(
    '/organizations/:orgId/apps/:appId/api-keys',
    {
      schema: CreateApiKeySchema,
      onRequest: [validateBaseToken],
    },
    controller.createApiKey.bind(controller)
  );

  // List API keys for app
  app.get(
    '/organizations/:orgId/apps/:appId/api-keys',
    {
      schema: ListApiKeysSchema,
      onRequest: [validateBaseToken],
    },
    controller.listApiKeys.bind(controller)
  );

  // Get API key details
  app.get(
    '/organizations/:orgId/apps/:appId/api-keys/:keyId',
    {
      schema: GetApiKeySchema,
      onRequest: [validateBaseToken],
    },
    controller.getApiKey.bind(controller)
  );

  // Revoke API key
  app.delete(
    '/organizations/:orgId/apps/:appId/api-keys/:keyId',
    {
      schema: RevokeApiKeySchema,
      onRequest: [validateBaseToken],
    },
    controller.revokeApiKey.bind(controller)
  );
}

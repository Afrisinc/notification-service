import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponseHelper } from './api-response';
import { AccountService } from '../services/account.service';
import { apiKeyRepository } from '../repositories/api-key.repository';

const accountService = new AccountService();

export interface AppContext {
  appId: string;
  accountId: string;
}

export async function resolveAppContext(req: FastifyRequest, reply: FastifyReply): Promise<AppContext | null> {
  const { appId: paramAppId } = req.params as { appId?: string };

  if (paramAppId) {
    const accountId = await accountService.getAccountIdByAppId(paramAppId);
    return { appId: paramAppId, accountId };
  }

  const accountId = req.headers['x-account-id'] as string | undefined;
  const apiKeyId = req.headers['x-api-key-id'] as string | undefined;

  if (!accountId) {
    ApiResponseHelper.unauthorized(reply, 'No account access');
    return null;
  }

  if (apiKeyId) {
    const apiKey = await apiKeyRepository.findById(apiKeyId);
    if (!apiKey) {
      ApiResponseHelper.unauthorized(reply, 'Invalid API key');
      return null;
    }
    return { appId: apiKey.app_id, accountId };
  }

  const body = req.body as { app_id?: string } | undefined;
  if (!body?.app_id) {
    ApiResponseHelper.badRequest(reply, 'app_id is required in request body');
    return null;
  }

  return { appId: body.app_id, accountId };
}

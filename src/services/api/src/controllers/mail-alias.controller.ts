import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { ApiResponseHelper } from '../utils/api-response';
import { mailAliasService } from '../services/mail-alias.service';

export async function listMailAliases(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const aliases = await mailAliasService.listAliases();
    return ApiResponseHelper.successList(reply, 'Mail aliases retrieved', aliases);
  } catch (error) {
    logger.error({ error }, 'Failed to list mail aliases');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve mail aliases');
  }
}

export async function addMailAlias(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { localPart, destinations } = request.body as { localPart: string; destinations: string[] };

    if (!localPart || !destinations?.length) {
      return ApiResponseHelper.missingFields(reply, 'localPart and destinations are required');
    }

    const alias = await mailAliasService.addAlias(localPart, destinations);
    return ApiResponseHelper.created(reply, 'Mail alias created', alias);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create mail alias';
    logger.error({ error }, 'Failed to add mail alias');
    if (message.includes('already exists')) {
      return ApiResponseHelper.duplicate(reply, message);
    }
    if (message.includes('Invalid')) {
      return ApiResponseHelper.invalidFormat(reply, message);
    }
    return ApiResponseHelper.internalError(reply, message);
  }
}

export async function updateMailAlias(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { localPart } = request.params as { localPart: string };
    const { destinations } = request.body as { destinations: string[] };

    if (!destinations?.length) {
      return ApiResponseHelper.missingFields(reply, 'destinations is required');
    }

    const alias = await mailAliasService.updateAlias(localPart, destinations);
    return ApiResponseHelper.updated(reply, 'Mail alias updated', alias);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update mail alias';
    logger.error({ error }, 'Failed to update mail alias');
    if (message.includes('not found')) {
      return ApiResponseHelper.notFound(reply, message);
    }
    if (message.includes('Invalid')) {
      return ApiResponseHelper.invalidFormat(reply, message);
    }
    return ApiResponseHelper.internalError(reply, message);
  }
}

export async function deleteMailAlias(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { localPart } = request.params as { localPart: string };
    await mailAliasService.deleteAlias(localPart);
    return ApiResponseHelper.deleted(reply, 'Mail alias deleted');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete mail alias';
    logger.error({ error }, 'Failed to delete mail alias');
    if (message.includes('not found')) {
      return ApiResponseHelper.notFound(reply, message);
    }
    return ApiResponseHelper.internalError(reply, message);
  }
}

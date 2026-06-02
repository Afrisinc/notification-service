import { FastifyRequest, FastifyReply } from 'fastify';
import { marketplaceService } from '../services/marketplace.service';
import { ApiResponseHelper } from '../utils';
import { logger } from '../config/logger';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

/**
 * Endpoint 1: List Marketplace Templates
 */
export async function listTemplates(req: FastifyRequest, reply: FastifyReply) {
  try {
    const query = req.query as {
      search?: string;
      channel?: string;
      category?: string;
      price?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: string;
      limit?: string;
    };

    const result = await marketplaceService.listTemplates({
      search: query.search,
      channel: query.channel,
      category: query.category,
      price: query.price,
      sortBy: query.sortBy,
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
      page: parseInt(query.page || '1', 10),
      limit: parseInt(query.limit || '12', 10),
    });

    return ApiResponseHelper.success(reply, 'Templates retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to list marketplace templates');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 2: Get Template Details
 */
export async function getTemplateDetails(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { templateId } = req.params as { templateId: string };

    const template = await marketplaceService.getTemplateDetails(templateId);

    return ApiResponseHelper.success(reply, 'Template retrieved successfully', template);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get template details');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 3: Install Template to App
 */
export async function installTemplate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = (req as any).user?.id;
    const body = req.body as {
      appId: string;
      templateName?: string;
      description?: string;
    };

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
    }

    if (!body.appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    const result = await marketplaceService.installTemplate(templateId, body.appId, userId, {
      templateName: body.templateName,
      description: body.description,
    });

    return ApiResponseHelper.created(reply, 'Template installed successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to install template');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 4: Rate Template
 */
export async function rateTemplate(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = (req as any).user?.id;
    const body = req.body as {
      rating: number;
      review?: string;
      helpful?: boolean;
    };

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
    }

    if (!body.rating) {
      return ApiResponseHelper.badRequest(reply, 'Rating is required');
    }

    const result = await marketplaceService.submitRating(templateId, userId, {
      rating: body.rating,
      review: body.review,
    });

    return ApiResponseHelper.success(reply, 'Rating submitted successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to submit rating');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 5: Get User Rating for Template
 */
export async function getUserRating(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { templateId } = req.params as { templateId: string };
    const userId = (req as any).user?.id;

    if (!userId) {
      return ApiResponseHelper.unauthorized(reply, 'User not authenticated');
    }

    const result = await marketplaceService.getUserRating(templateId, userId);

    return ApiResponseHelper.success(reply, 'Rating retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not rated')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get user rating');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 6: Get Marketplace Categories
 */
export async function getCategories(req: FastifyRequest, reply: FastifyReply) {
  try {
    const categories = await marketplaceService.getCategories();

    return ApiResponseHelper.success(reply, 'Categories retrieved successfully', {
      categories,
    });
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to get categories');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * Endpoint 7: Init payment for a paid marketplace template
 * POST /marketplace/templates/:templateId/payment/init
 * Body: { appId, customerEmail }
 */
export async function initTemplatePayment(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { templateId } = req.params as { templateId: string };
    const { appId, customerEmail } = req.body as { appId: string; customerEmail: string };
    const accountId = (req.headers['x-account-id'] as string) || '';

    if (!accountId) return ApiResponseHelper.unauthorized(reply, 'Missing x-account-id');
    if (!appId) return ApiResponseHelper.badRequest(reply, 'appId is required');
    if (!customerEmail) return ApiResponseHelper.badRequest(reply, 'customerEmail is required');

    const { MarketplacePaymentService } = await import('../services/marketplace-payment.service');
    const result = await MarketplacePaymentService.initPayment(accountId, templateId, appId, customerEmail);

    return ApiResponseHelper.success(reply, 'Payment intent created', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to init template payment');
    const status = (err as any)?.statusCode;
    if (status === 404) return ApiResponseHelper.notFound(reply, errorMessage);
    if (status === 422) return ApiResponseHelper.badRequest(reply, errorMessage);
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

import { FastifyRequest, FastifyReply } from 'fastify';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils/api-response';

export const planGuards = {
  /**
   * Guard: Ensure feature is available in plan
   */
  requireFeature: (feature: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const allowed = await PlanEnforcementMiddleware.checkFeatureAccess(accountId, feature);

      if (!allowed) {
        return ApiResponseHelper.error(
          reply,
          `Feature "${feature}" is not available in your current plan. Please upgrade.`,
          4021,
          403
        );
      }
    };
  },

  /**
   * Guard: Check usage limit for metric
   */
  checkUsageLimit: (metric: string, quantityRequired: number = 1) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, metric);

      if (!result.allowed || result.remaining < quantityRequired) {
        return ApiResponseHelper.error(
          reply,
          `Usage limit exceeded for "${metric}". Limit: ${result.limit === -1 ? 'Unlimited' : result.limit}, Remaining: ${result.remaining === -1 ? 'Unlimited' : result.remaining}`,
          4020,
          403
        );
      }
    };
  },

  /**
   * Guard: Check entity count limit
   */
  checkEntityLimit: (entity: 'apps' | 'templates' | 'campaigns' | 'contacts') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = request.headers['x-account-id'] as string;

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Account ID required');
      }

      const result = await PlanEnforcementMiddleware.checkEntityLimit(accountId, entity);

      if (!result.allowed) {
        return ApiResponseHelper.error(
          reply,
          `Cannot create more ${entity}. Plan limit reached: ${result.limit}. Please upgrade your plan.`,
          4020,
          403
        );
      }
    };
  },
};

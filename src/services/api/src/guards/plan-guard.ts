import { FastifyRequest, FastifyReply } from 'fastify';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils/api-response';
import { accountRepository } from '../repositories/account.repository';

async function getAccountId(request: FastifyRequest): Promise<string | null> {
  const { orgId } = request.params as { orgId?: string };
  const headerAccountId = request.headers['x-account-id'] as string;

  if (orgId) {
    const account = await accountRepository.findAccountByOrganizationId(orgId);

    return account?.id || null;
  }

  return headerAccountId || null;
}

export const planGuards = {
  /**
   * Guard: Ensure feature is available in plan
   */
  requireFeature: (feature: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = await getAccountId(request);

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Organization ID or Account ID required');
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
      const accountId = await getAccountId(request);

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Organization ID or Account ID required');
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
  checkEntityLimit: (entity: 'apps' | 'templates' | 'campaigns' | 'contacts' | 'team_members' | 'api_keys') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = await getAccountId(request);

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Organization ID or Account ID required');
      }

      const result = await PlanEnforcementMiddleware.checkEntityLimit(accountId, entity);

      if (!result.allowed) {
        const entityName = entity.replace('_', ' ');
        return ApiResponseHelper.error(
          reply,
          `Cannot create more ${entityName}. Plan limit reached: ${result.limit}. Please upgrade your plan.`,
          4020,
          403
        );
      }
    };
  },

  /**
   * Guard: Check webhook limit (uses webhooks metric from plan_limits)
   */
  checkWebhookLimit: () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = await getAccountId(request);

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Organization ID or Account ID required');
      }

      const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, 'webhooks');

      if (!result.allowed) {
        return ApiResponseHelper.error(
          reply,
          `Cannot create more webhooks. Plan limit reached: ${result.limit}. Please upgrade your plan.`,
          4020,
          403
        );
      }
    };
  },

  /**
   * Guard: Check custom domain limit
   */
  checkCustomDomainLimit: () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = await getAccountId(request);

      if (!accountId) {
        return ApiResponseHelper.unauthorized(reply, 'Organization ID or Account ID required');
      }

      const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, 'custom_domain');

      if (!result.allowed) {
        return ApiResponseHelper.error(
          reply,
          `Cannot add more custom domains. Plan limit reached: ${result.limit}. Please upgrade your plan.`,
          4020,
          403
        );
      }
    };
  },
};

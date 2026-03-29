import { FastifyRequest, FastifyReply } from 'fastify';
import { PlanManagementService } from '../services/plan-management.service';
import { ApiResponseHelper } from '../utils/api-response';
import { logger } from '../config/logger';

export class PlanManagementController {
  /**
   * GET /api/admin/plans
   * Get all plans with limits
   */
  async getAllPlans(request: FastifyRequest, reply: FastifyReply) {
    try {
      const plans = await PlanManagementService.getAllPlans();

      logger.info({ correlationId: request.id }, 'All plans retrieved');

      return ApiResponseHelper.successList(reply, 'Plans retrieved', plans, {
        total: plans.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get plans');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * GET /api/admin/plans/:planId
   * Get specific plan with limits
   */
  async getPlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };

      const plan = await PlanManagementService.getPlanById(planId);

      logger.info({ planId, correlationId: request.id }, 'Plan retrieved');

      return ApiResponseHelper.success(reply, 'Plan retrieved', plan);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get plan');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, 'Plan not found');
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * PUT /api/admin/plans/:planId/limits/:limitId
   * Update a single limit
   */
  async updateLimit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId, limitId } = request.params as { planId: string; limitId: string };
      const { limit_value, reason } = request.body as { limit_value: number; reason?: string };

      if (typeof limit_value !== 'number') {
        return ApiResponseHelper.badRequest(reply, 'limit_value must be a number');
      }

      const userEmail = (request as any).user?.email || 'api';

      const updated = await PlanManagementService.updateLimit(planId, limitId, limit_value, reason, userEmail);

      logger.info({ planId, limitId, newValue: limit_value, correlationId: request.id }, 'Limit updated');

      return ApiResponseHelper.success(reply, 'Limit updated successfully', updated);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to update limit');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      if (errorMessage.includes('must be')) {
        return ApiResponseHelper.badRequest(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * PUT /api/admin/plans/:planId/limits/batch
   * Batch update multiple limits
   */
  async batchUpdateLimits(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };
      const { updates, reason } = request.body as {
        updates: Array<{ metric: string; limit_value: number }>;
        reason?: string;
      };

      if (!Array.isArray(updates) || updates.length === 0) {
        return ApiResponseHelper.badRequest(reply, 'updates must be a non-empty array');
      }

      const userEmail = (request as any).user?.email || 'api';

      const results = await PlanManagementService.batchUpdateLimits(planId, updates, reason, userEmail);

      logger.info({ planId, updatedCount: results.length, correlationId: request.id }, 'Batch limit update completed');

      return ApiResponseHelper.success(
        reply,
        'Limits updated successfully',
        {
          plan_id: planId,
          updated_count: results.length,
          limits: results,
        },
        200
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to batch update limits');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * POST /api/admin/plans/:planId/limits
   * Create new limit for a plan
   */
  async createLimit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };
      const { metric, limit_value, period } = request.body as {
        metric: string;
        limit_value: number;
        period?: string;
      };

      if (!metric) {
        return ApiResponseHelper.badRequest(reply, 'metric is required');
      }

      if (typeof limit_value !== 'number') {
        return ApiResponseHelper.badRequest(reply, 'limit_value must be a number');
      }

      const limit = await PlanManagementService.createLimit(planId, metric, limit_value, period);

      logger.info({ planId, metric, correlationId: request.id }, 'Limit created');

      return ApiResponseHelper.success(reply, 'Limit created successfully', limit, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to create limit');

      if (errorMessage.includes('not found') || errorMessage.includes('already exists')) {
        return ApiResponseHelper.badRequest(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * DELETE /api/admin/plans/:planId/limits/:limitId
   * Delete a limit
   */
  async deleteLimit(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId, limitId } = request.params as { planId: string; limitId: string };

      await PlanManagementService.deleteLimit(planId, limitId);

      logger.info({ planId, limitId, correlationId: request.id }, 'Limit deleted');

      return ApiResponseHelper.success(reply, 'Limit deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to delete limit');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * GET /api/admin/plans/:planId/limits/history
   * Get limit change history
   */
  async getLimitChangeHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };

      const history = await PlanManagementService.getLimitChangeHistory(planId);

      logger.info({ planId, recordCount: history.length, correlationId: request.id }, 'Limit history retrieved');

      return ApiResponseHelper.successList(reply, 'Limit history retrieved', history, {
        total: history.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get history');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * POST /api/admin/accounts/:accountId/limit-override
   * Set temporary limit override for account
   */
  async setLimitOverride(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { accountId } = request.params as { accountId: string };
      const { metric, temporary_limit, expires_at, reason } = request.body as {
        metric: string;
        temporary_limit: number;
        expires_at?: string;
        reason?: string;
      };

      if (!metric) {
        return ApiResponseHelper.badRequest(reply, 'metric is required');
      }

      if (typeof temporary_limit !== 'number') {
        return ApiResponseHelper.badRequest(reply, 'temporary_limit must be a number');
      }

      const expiresDate = expires_at ? new Date(expires_at) : undefined;

      if (expiresDate && isNaN(expiresDate.getTime())) {
        return ApiResponseHelper.badRequest(reply, 'expires_at must be a valid ISO date');
      }

      const override = await PlanManagementService.setTemporaryOverride(
        accountId,
        metric,
        temporary_limit,
        expiresDate,
        reason
      );

      logger.info({ accountId, metric, correlationId: request.id }, 'Limit override set');

      return ApiResponseHelper.success(reply, 'Limit override set successfully', override, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to set override');

      if (errorMessage.includes('not found')) {
        return ApiResponseHelper.notFound(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * GET /api/admin/accounts/:accountId/limit-overrides
   * Get account limit overrides
   */
  async getAccountOverrides(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { accountId } = request.params as { accountId: string };

      const overrides = await PlanManagementService.getAccountLimitOverrides(accountId);

      logger.info(
        { accountId, overrideCount: overrides.length, correlationId: request.id },
        'Account overrides retrieved'
      );

      return ApiResponseHelper.successList(reply, 'Account overrides retrieved', overrides, {
        total: overrides.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get overrides');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * DELETE /api/admin/accounts/:accountId/limit-overrides/:metric
   * Remove a specific override
   */
  async removeOverride(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { accountId, metric } = request.params as { accountId: string; metric: string };

      await PlanManagementService.removeOverride(accountId, metric);

      logger.info({ accountId, metric, correlationId: request.id }, 'Override removed');

      return ApiResponseHelper.success(reply, 'Override removed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to remove override');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }

  /**
   * GET /api/admin/dashboard/limits-usage
   * Get dashboard statistics
   */
  async getDashboardStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await PlanManagementService.getDashboardStats();

      logger.debug({ correlationId: request.id }, 'Dashboard stats retrieved');

      return ApiResponseHelper.success(reply, 'Dashboard stats retrieved', stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, correlationId: request.id }, 'Failed to get stats');

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const planManagementController = new PlanManagementController();

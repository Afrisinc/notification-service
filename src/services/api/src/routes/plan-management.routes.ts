import { FastifyInstance } from 'fastify';
import { planManagementController } from '../controllers/plan-management.controller';
import { asyncWrapper } from '../middlewares/async_wrapper.middleware';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { adminGuard } from '../middleware/admin.middleware';
import {
  GetAllPlansSchema,
  GetPlanSchema,
  UpdateLimitSchema,
  BatchUpdateLimitsSchema,
  CreateLimitSchema,
  DeleteLimitSchema,
  GetLimitHistorySchema,
  SetLimitOverrideSchema,
  GetAccountOverridesSchema,
  RemoveOverrideSchema,
  GetDashboardStatsSchema,
} from '../schemas/routes/plan-management.schema';

/**
 * Admin Plan Management Routes
 * All routes require admin authentication
 */
export async function registerPlanManagementRoutes(fastify: FastifyInstance) {
  // ========================
  // Plan Limits Management
  // ========================

  /**
   * GET /api/admin/plans
   * List all plans with limits
   */
  fastify.get(
    '/admin/plans',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: GetAllPlansSchema,
    },
    asyncWrapper(planManagementController.getAllPlans.bind(planManagementController))
  );

  /**
   * GET /api/admin/plans/:planId
   * Get specific plan with limits
   */
  fastify.get(
    '/admin/plans/:planId',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: GetPlanSchema,
    },
    asyncWrapper(planManagementController.getPlan.bind(planManagementController))
  );

  /**
   * PUT /api/admin/plans/:planId/limits/:limitId
   * Update a single limit
   */
  fastify.put(
    '/admin/plans/:planId/limits/:limitId',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: UpdateLimitSchema,
    },
    asyncWrapper(planManagementController.updateLimit.bind(planManagementController))
  );

  /**
   * PUT /api/admin/plans/:planId/limits/batch
   * Batch update multiple limits (must come before :limitId route)
   */
  fastify.put(
    '/admin/plans/:planId/limits/batch',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: BatchUpdateLimitsSchema,
    },
    asyncWrapper(planManagementController.batchUpdateLimits.bind(planManagementController))
  );

  /**
   * POST /api/admin/plans/:planId/limits
   * Create new limit for a plan
   */
  fastify.post(
    '/admin/plans/:planId/limits',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: CreateLimitSchema,
    },
    asyncWrapper(planManagementController.createLimit.bind(planManagementController))
  );

  /**
   * DELETE /api/admin/plans/:planId/limits/:limitId
   * Delete a limit
   */
  fastify.delete(
    '/admin/plans/:planId/limits/:limitId',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: DeleteLimitSchema,
    },
    asyncWrapper(planManagementController.deleteLimit.bind(planManagementController))
  );

  /**
   * GET /api/admin/plans/:planId/limits/history
   * Get limit change history (must come before :limitId route)
   */
  fastify.get(
    '/admin/plans/:planId/limits/history',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: GetLimitHistorySchema,
    },
    asyncWrapper(planManagementController.getLimitChangeHistory.bind(planManagementController))
  );

  // ========================
  // Account Limit Overrides
  // ========================

  /**
   * POST /api/admin/accounts/:accountId/limit-override
   * Set temporary limit override for account
   */
  fastify.post(
    '/admin/accounts/:accountId/limit-override',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: SetLimitOverrideSchema,
    },
    asyncWrapper(planManagementController.setLimitOverride.bind(planManagementController))
  );

  /**
   * GET /api/admin/accounts/:accountId/limit-overrides
   * Get all overrides for account
   */
  fastify.get(
    '/admin/accounts/:accountId/limit-overrides',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: GetAccountOverridesSchema,
    },
    asyncWrapper(planManagementController.getAccountOverrides.bind(planManagementController))
  );

  /**
   * DELETE /api/admin/accounts/:accountId/limit-overrides/:metric
   * Remove specific override
   */
  fastify.delete(
    '/admin/accounts/:accountId/limit-overrides/:metric',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: RemoveOverrideSchema,
    },
    asyncWrapper(planManagementController.removeOverride.bind(planManagementController))
  );

  // ========================
  // Admin Dashboard
  // ========================

  /**
   * GET /api/admin/dashboard/limits-usage
   * Get dashboard statistics
   */
  fastify.get(
    '/admin/dashboard/limits-usage',
    {
      onRequest: [validateBaseToken, adminGuard],
      schema: GetDashboardStatsSchema,
    },
    asyncWrapper(planManagementController.getDashboardStats.bind(planManagementController))
  );
}

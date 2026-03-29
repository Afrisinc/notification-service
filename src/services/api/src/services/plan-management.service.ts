import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

export class PlanManagementService {
  /**
   * Get all plans with their limits
   */
  static async getAllPlans() {
    try {
      return prismaRead.plan.findMany({
        include: { limits: true },
        orderBy: { price_monthly: 'asc' },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get all plans');
      throw error;
    }
  }

  /**
   * Get single plan with limits
   */
  static async getPlanById(planId: string) {
    try {
      const plan = prismaRead.plan.findUnique({
        where: { id: planId },
        include: { limits: true },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      return plan;
    } catch (error) {
      logger.error({ error, planId }, 'Failed to get plan');
      throw error;
    }
  }

  /**
   * Update a single limit
   */
  static async updateLimit(
    planId: string,
    limitId: string,
    newValue: number,
    reason?: string,
    changedBy: string = 'api'
  ) {
    try {
      // Verify plan exists
      const plan = await prismaRead.plan.findUnique({
        where: { id: planId },
        include: { limits: true },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get old value for history
      const oldLimit = plan.limits.find((l) => l.id === limitId);

      if (!oldLimit) {
        throw new Error('Limit not found');
      }

      // Validate new value
      if (newValue < -1) {
        throw new Error('Limit value must be >= -1 (where -1 means unlimited)');
      }

      // Update limit
      const updated = await prismaWrite.planLimit.update({
        where: { id: limitId },
        data: { limit_value: newValue },
      });

      // Record change history
      await prismaWrite.limitChangeHistory.create({
        data: {
          limit_id: limitId,
          metric: oldLimit.metric,
          old_value: oldLimit.limit_value,
          new_value: newValue,
          reason,
          changed_by: changedBy,
        },
      });

      logger.info(
        { planId, limitId, metric: oldLimit.metric, oldValue: oldLimit.limit_value, newValue },
        'Limit updated'
      );

      return {
        ...updated,
        previous_value: oldLimit.limit_value,
      };
    } catch (error) {
      logger.error({ error, planId, limitId }, 'Failed to update limit');
      throw error;
    }
  }

  /**
   * Batch update multiple limits for a plan
   */
  static async batchUpdateLimits(
    planId: string,
    updates: Array<{ metric: string; limit_value: number }>,
    reason?: string,
    changedBy: string = 'api'
  ) {
    try {
      const results: any[] = [];

      for (const update of updates) {
        const limit = await prismaRead.planLimit.findFirst({
          where: { plan_id: planId, metric: update.metric },
        });

        if (limit) {
          const updated = await this.updateLimit(planId, limit.id, update.limit_value, reason, changedBy);
          results.push({
            metric: update.metric,
            old_value: limit.limit_value,
            new_value: update.limit_value,
          });
        }
      }

      logger.info({ planId, updatedCount: results.length }, 'Batch limit update completed');

      return results;
    } catch (error) {
      logger.error({ error, planId }, 'Failed to batch update limits');
      throw error;
    }
  }

  /**
   * Create a new limit for a plan
   */
  static async createLimit(planId: string, metric: string, limitValue: number, period: string = 'monthly') {
    try {
      // Verify plan exists
      const plan = await prismaRead.plan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Check if limit already exists
      const existing = await prismaRead.planLimit.findFirst({
        where: { plan_id: planId, metric },
      });

      if (existing) {
        throw new Error(`Limit for metric "${metric}" already exists for this plan`);
      }

      const limit = await prismaWrite.planLimit.create({
        data: {
          plan_id: planId,
          metric,
          limit_value: limitValue,
          period,
        },
      });

      // Record history
      await prismaWrite.limitChangeHistory.create({
        data: {
          limit_id: limit.id,
          metric,
          old_value: 0,
          new_value: limitValue,
          reason: 'Initial limit creation',
          changed_by: 'api',
        },
      });

      logger.info({ planId, metric, limitValue }, 'Limit created');

      return limit;
    } catch (error) {
      logger.error({ error, planId, metric }, 'Failed to create limit');
      throw error;
    }
  }

  /**
   * Delete a limit
   */
  static async deleteLimit(planId: string, limitId: string) {
    try {
      // Verify limit exists and belongs to plan
      const limit = await prismaRead.planLimit.findFirst({
        where: { id: limitId, plan_id: planId },
      });

      if (!limit) {
        throw new Error('Limit not found');
      }

      await prismaWrite.planLimit.delete({
        where: { id: limitId },
      });

      logger.info({ planId, limitId, metric: limit.metric }, 'Limit deleted');

      return { success: true };
    } catch (error) {
      logger.error({ error, planId, limitId }, 'Failed to delete limit');
      throw error;
    }
  }

  /**
   * Get limit change history for a plan
   */
  static async getLimitChangeHistory(planId: string) {
    try {
      const history = await prismaRead.limitChangeHistory.findMany({
        where: {
          planLimit: { plan_id: planId },
        },
        orderBy: { changed_at: 'desc' },
      });

      return history;
    } catch (error) {
      logger.error({ error, planId }, 'Failed to get limit change history');
      throw error;
    }
  }

  /**
   * Get effective limit (considering overrides)
   */
  static async getEffectiveLimit(accountId: string, metric: string): Promise<number> {
    try {
      // Check for active override
      const override = await prismaRead.limitOverride.findFirst({
        where: {
          account_id: accountId,
          metric,
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
      });

      if (override) {
        logger.debug({ accountId, metric }, 'Using override limit');
        return override.temporary_limit;
      }

      // Get plan limit
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      const limit = subscription?.plan.limits.find((l) => l.metric === metric);
      return limit?.limit_value || 0;
    } catch (error) {
      logger.error({ error, accountId, metric }, 'Failed to get effective limit');
      throw error;
    }
  }

  /**
   * Set temporary override for account
   */
  static async setTemporaryOverride(
    accountId: string,
    metric: string,
    temporaryLimit: number,
    expiresAt?: Date,
    reason?: string
  ) {
    try {
      // Verify account exists
      const account = await prismaRead.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Get plan limit
      const subscription = await prismaRead.subscription.findUnique({
        where: { account_id: accountId },
        include: { plan: { include: { limits: true } } },
      });

      const planLimit = subscription?.plan.limits.find((l) => l.metric === metric);
      if (!planLimit) {
        throw new Error(`Metric "${metric}" not found in account's plan`);
      }

      const override = await prismaWrite.limitOverride.upsert({
        where: {
          account_id_metric: { account_id: accountId, metric },
        },
        update: {
          temporary_limit: temporaryLimit,
          expires_at: expiresAt || null,
          updated_at: new Date(),
        },
        create: {
          account_id: accountId,
          metric,
          plan_limit: planLimit.limit_value,
          temporary_limit: temporaryLimit,
          expires_at: expiresAt || null,
        },
      });

      logger.info({ accountId, metric, temporaryLimit, expiresAt }, 'Limit override set');

      return override;
    } catch (error) {
      logger.error({ error, accountId, metric }, 'Failed to set temporary override');
      throw error;
    }
  }

  /**
   * Get account limit overrides
   */
  static async getAccountLimitOverrides(accountId: string) {
    try {
      const overrides = await prismaRead.limitOverride.findMany({
        where: { account_id: accountId },
      });

      // Mark which ones are active
      const now = new Date();
      return overrides.map((o) => ({
        ...o,
        is_active: !o.expires_at || o.expires_at > now,
      }));
    } catch (error) {
      logger.error({ error, accountId }, 'Failed to get account overrides');
      throw error;
    }
  }

  /**
   * Remove/delete an override
   */
  static async removeOverride(accountId: string, metric: string) {
    try {
      await prismaWrite.limitOverride.deleteMany({
        where: { account_id: accountId, metric },
      });

      logger.info({ accountId, metric }, 'Override removed');

      return { success: true };
    } catch (error) {
      logger.error({ error, accountId, metric }, 'Failed to remove override');
      throw error;
    }
  }

  /**
   * Clean up expired overrides (scheduled job)
   */
  static async cleanupExpiredOverrides() {
    try {
      const deleted = await prismaWrite.limitOverride.deleteMany({
        where: {
          expires_at: { lte: new Date() },
        },
      });

      logger.info({ deletedCount: deleted.count }, 'Expired overrides cleaned up');

      return deleted.count;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired overrides');
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats() {
    try {
      const plans = await prismaRead.plan.findMany();
      const activeOverrides = await prismaRead.limitOverride.count({
        where: { expires_at: { gt: new Date() } },
      });

      const changesThisWeek = await prismaRead.limitChangeHistory.count({
        where: {
          changed_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      return {
        total_plans: plans.length,
        limits_changed_today: await prismaRead.limitChangeHistory.count({
          where: {
            changed_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        active_overrides: activeOverrides,
        changes_this_week: changesThisWeek,
        plans: plans.map((p) => ({
          name: p.name,
          changes_this_week: 0, // Could be calculated per-plan if needed
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get dashboard stats');
      throw error;
    }
  }
}

import { prismaRead } from '@shared/database';
import { logger } from '../config/logger';

/**
 * Analytics Repository
 * Handles all analytics data access operations
 */
export class AnalyticsRepository {
  /**
   * Get platform overview statistics
   */
  async getOverview() {
    try {
      const [totalUsers, totalAccounts, totalOrganizations] = await Promise.all([
        prismaRead.user.count(),
        prismaRead.account.count(),
        prismaRead.organization.count(),
      ]);

      return {
        total_users: totalUsers,
        total_accounts: totalAccounts,
        total_organizations: totalOrganizations,
        total_enrollments: 0,
        active_enrollments: 0,
        suspended_enrollments: 0,
        individual_accounts: 0,
        organization_accounts: 0,
        products: [],
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch analytics overview');
      throw error;
    }
  }

  /**
   * Get user analytics for a date range
   */
  async getUserAnalytics(days: number = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [totalUsers, newUsersInRange, verifiedUsers] = await Promise.all([
        prismaRead.user.count(),
        prismaRead.user.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        }),
        prismaRead.user.count({
          where: {
            email_verified: true,
          },
        }),
      ]);

      return {
        total_users: totalUsers,
        new_users_in_range: newUsersInRange,
        verified_users: verifiedUsers,
        suspended_users: 0,
        active_users_in_range: newUsersInRange,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user analytics');
      throw error;
    }
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [totalAccounts, individualAccounts, organizationAccounts, newAccounts30d] = await Promise.all([
        prismaRead.account.count(),
        prismaRead.account.count({
          where: { type: 'INDIVIDUAL' },
        }),
        prismaRead.account.count({
          where: { type: 'ORGANIZATION' },
        }),
        prismaRead.account.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
      ]);

      return {
        total_accounts: totalAccounts,
        individual_accounts: individualAccounts,
        organization_accounts: organizationAccounts,
        new_accounts_30d: newAccounts30d,
        active_accounts_30d: newAccounts30d,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch account analytics');
      throw error;
    }
  }

  /**
   * Get growth metrics for a date range
   */
  async getGrowthMetrics(days: number = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      logger.debug({ since, days }, 'Fetching growth metrics for date range');

      // Fetch users and accounts created in the date range
      let users: Array<{ createdAt: Date }> = [];
      let accounts: Array<{ createdAt: Date }> = [];

      try {
        users = await prismaRead.user.findMany({
          where: {
            createdAt: {
              gte: since,
            },
          },
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
        logger.debug({ userCount: users.length }, 'Users fetched');
      } catch (err) {
        logger.warn({ error: err }, 'Failed to fetch users, continuing with empty list');
      }

      try {
        accounts = await prismaRead.account.findMany({
          where: {
            createdAt: {
              gte: since,
            },
          },
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
        logger.debug({ accountCount: accounts.length }, 'Accounts fetched');
      } catch (err) {
        logger.warn({ error: err }, 'Failed to fetch accounts, continuing with empty list');
      }

      // Aggregate by date
      const usersByDate = this.aggregateByDate(users.map((u) => u.createdAt));
      const accountsByDate = this.aggregateByDate(accounts.map((a) => a.createdAt));

      const result = {
        users: Array.isArray(usersByDate) ? usersByDate : [],
        accounts: Array.isArray(accountsByDate) ? accountsByDate : [],
        enrollments: [], // Implement when enrollment model is available
      };

      logger.info({ result }, 'Growth metrics computed successfully');
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch growth metrics');
      // Return empty structure instead of throwing
      return {
        users: [],
        accounts: [],
        enrollments: [],
      };
    }
  }

  /**
   * Aggregate dates into daily counts
   */
  private aggregateByDate(dates: Date[]): Array<{ date: string; count: number }> {
    const dateMap = new Map<string, number>();

    dates.forEach((date) => {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    });

    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

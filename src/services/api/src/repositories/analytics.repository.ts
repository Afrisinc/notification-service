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
   * Get all users with their accounts, organizations, and last login
   */
  async getAllUsersWithDetails(page: number = 1, limit: number = 10) {
    try {
      // Calculate skip value
      const skip = (page - 1) * limit;

      // Get total count
      const total = await prismaRead.user.count();

      // Fetch paginated users
      const users = await prismaRead.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          email_verified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      // Fetch all accounts with organizations
      const accounts = await prismaRead.account.findMany({
        select: {
          id: true,
          type: true,
          owner_user_id: true,
          organization_id: true,
          createdAt: true,
        },
      });

      const organizations = await prismaRead.organization.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      const orgMap = new Map(organizations.map((org) => [org.id, org]));

      // Map accounts to users
      const usersWithAccounts = users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.email_verified,
        lastActivity: user.updatedAt, // Last activity timestamp (last update to user profile)
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        accounts: accounts
          .filter((acc) => acc.owner_user_id === user.id)
          .map((account) => ({
            id: account.id,
            type: account.type,
            organization: account.organization_id ? orgMap.get(account.organization_id) || null : null,
            createdAt: account.createdAt,
          })),
      }));

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit);

      return {
        data: usersWithAccounts,
        meta: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch users with details');
      throw error;
    }
  }

  /**
   * Get a specific user with full details
   */
  async getUserWithDetails(userId: string) {
    try {
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          email_verified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return null;
      }

      // Fetch user's accounts
      const accounts = await prismaRead.account.findMany({
        where: {
          owner_user_id: userId,
        },
        select: {
          id: true,
          type: true,
          organization_id: true,
          createdAt: true,
        },
      });

      // Fetch organizations
      const organizations = await prismaRead.organization.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      const orgMap = new Map(organizations.map((org) => [org.id, org]));

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.email_verified,
        lastActivity: user.updatedAt, // Last activity timestamp (last update to user profile)
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        accounts: accounts.map((account) => ({
          id: account.id,
          type: account.type,
          organization: account.organization_id ? orgMap.get(account.organization_id) || null : null,
          createdAt: account.createdAt,
        })),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch user details');
      throw error;
    }
  }

  /**
   * Get credit transactions across all accounts with comprehensive filtering
   * Used by admin dashboard to track payment transactions for support purposes
   */
  async getCreditTransactions(options: {
    page: number;
    limit: number;
    accountId?: string;
    type?: string[];
    status?: string[];
    channel?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    try {
      const skip = (options.page - 1) * options.limit;
      const where = this.buildCreditTransactionWhereClause(options);
      const orderBy: any = {};
      orderBy[options.sortBy] = options.sortOrder;

      const [transactions, total] = await prismaRead.$transaction([
        prismaRead.creditTransaction.findMany({
          where,
          include: {
            account: {
              select: {
                id: true,
                type: true,
                owner: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                organization: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy,
          skip,
          take: options.limit,
        }),
        prismaRead.creditTransaction.count({ where }),
      ]);

      // Aggregation separate to avoid Prisma transaction typing issues
      const typeAgg = await prismaRead.creditTransaction.groupBy({
        by: ['type'],
        where,
        _count: true,
        _sum: { amount: true },
      });

      return { transactions, total, typeAgg };
    } catch (error) {
      logger.error({ error }, 'Failed to fetch credit transactions');
      throw error;
    }
  }

  private buildCreditTransactionWhereClause(options: {
    accountId?: string;
    type?: string[];
    status?: string[];
    channel?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  }): any {
    const where: any = {};

    if (options.accountId) {
      where.account_id = options.accountId;
    }

    if (options.type?.length) {
      where.type = { in: options.type };
    }

    if (options.status?.length) {
      where.status = { in: options.status };
    }

    if (options.channel?.length) {
      where.channel = { in: options.channel };
    }

    if (options.dateFrom || options.dateTo) {
      where.created_at = this.buildDateRange(options.dateFrom, options.dateTo);
    }

    if (options.minAmount !== undefined || options.maxAmount !== undefined) {
      where.amount = this.buildAmountRange(options.minAmount, options.maxAmount);
    }

    if (options.search) {
      where.OR = [
        { payment_ref: { contains: options.search, mode: 'insensitive' } },
        { account: { owner: { email: { contains: options.search, mode: 'insensitive' } } } },
      ];
    }

    return where;
  }

  private buildDateRange(dateFrom?: Date, dateTo?: Date): any {
    const range: any = {};
    if (dateFrom) range.gte = dateFrom;
    if (dateTo) range.lte = dateTo;
    return range;
  }

  private buildAmountRange(minAmount?: number, maxAmount?: number): any {
    const range: any = {};
    if (minAmount !== undefined) range.gte = minAmount;
    if (maxAmount !== undefined) range.lte = maxAmount;
    return range;
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

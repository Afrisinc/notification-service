import { AnalyticsRepository } from '../repositories/analytics.repository';

const analyticsRepo = new AnalyticsRepository();

export class AnalyticsService {
  async getOverview() {
    return analyticsRepo.getOverview();
  }

  async getUserAnalytics(range: string = '30d') {
    const days = this.parseRangeInDays(range);
    return analyticsRepo.getUserAnalytics(days);
  }

  async getAccountAnalytics() {
    return analyticsRepo.getAccountAnalytics();
  }

  async getGrowthMetrics(range: string = '30d') {
    const days = this.parseRangeInDays(range);
    return analyticsRepo.getGrowthMetrics(days);
  }

  async getAllUsersWithDetails(page: number = 1, limit: number = 10) {
    return analyticsRepo.getAllUsersWithDetails(page, limit);
  }

  async getUserWithDetails(userId: string) {
    return analyticsRepo.getUserWithDetails(userId);
  }

  /**
   * Get credit transactions for admin dashboard
   * Transforms repository data into DTO format with summary statistics
   */
  async getCreditTransactions(options: {
    page: number;
    limit: number;
    accountId?: string;
    type?: string;
    channel?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { transactions, total, typeAgg } = await analyticsRepo.getCreditTransactions({
      page: options.page,
      limit: options.limit,
      accountId: options.accountId,
      type: options.type?.split(',').filter(Boolean),
      channel: options.channel?.split(',').filter(Boolean),
      dateFrom: options.dateFrom ? new Date(options.dateFrom) : undefined,
      dateTo: options.dateTo ? new Date(options.dateTo) : undefined,
      minAmount: options.minAmount,
      maxAmount: options.maxAmount,
      search: options.search,
      sortBy: options.sortBy || 'created_at',
      sortOrder: (options.sortOrder as 'asc' | 'desc') || 'desc',
    });

    const data = transactions.map((tx) => ({
      transactionId: tx.id,
      creditBalanceId: tx.credit_balance_id,
      accountId: tx.account_id,
      userId: tx.account.owner.id,
      accountEmail: tx.account.owner.email,
      accountName: [tx.account.owner.firstName || '', tx.account.owner.lastName || ''].filter(Boolean).join(' ').trim(),
      accountType: tx.account.type,
      organizationId: tx.account.organization?.id || null,
      organizationName: tx.account.organization?.name || null,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      description: tx.description,
      channel: tx.channel,
      notificationId: tx.notification_id,
      paymentRef: tx.payment_ref,
      bonusPercent: tx.bonus_percent,
      // IMPORTANT: Only shown if webhook confirmed (credit already applied)
      paymentStatus: tx.type === 'topup' ? 'WEBHOOK_CONFIRMED' : null,
      isCompleted: tx.type === 'topup',
      paymentNote: tx.type === 'topup' ? 'Payment confirmed via webhook from africnc-pay' : null,
      createdAt: tx.created_at.toISOString(),
    }));

    // Calculate summary statistics
    const countByType = {
      topup: 0,
      deduction: 0,
      bonus: 0,
      refund: 0,
    };

    let totalAmount = 0;

    typeAgg.forEach((group) => {
      countByType[group.type as keyof typeof countByType] = group._count;
      totalAmount += group._sum?.amount || 0;
    });

    return {
      data,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
        summary: {
          totalAmount,
          countByType,
          dateRange: {
            from: options.dateFrom || null,
            to: options.dateTo || null,
          },
        },
      },
    };
  }

  private parseRangeInDays(range: string): number {
    const match = range.match(/(\d+)(d|w|m)/);
    if (!match) return 30;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value;
      case 'w':
        return value * 7;
      case 'm':
        return value * 30;
      default:
        return 30;
    }
  }
}

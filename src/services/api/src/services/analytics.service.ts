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

import type { FastifyReply, FastifyRequest } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponseHelper } from '../utils';
import { getErrorMessage } from '../utils/errorHandler';

export class PlatformController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async getAnalyticsOverview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await this.analyticsService.getOverview();
      return ApiResponseHelper.success(reply, 'Analytics retrieved successfully', data);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }

  async getAnalyticsUsers(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { range } = req.query as { range?: string };
      const data = await this.analyticsService.getUserAnalytics(range || '30d');
      return ApiResponseHelper.success(reply, 'User analytics retrieved successfully', data);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }

  async getAnalyticsAccounts(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await this.analyticsService.getAccountAnalytics();
      return ApiResponseHelper.success(reply, 'Account analytics retrieved successfully', data);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }

  async getAnalyticsGrowth(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { range } = req.query as { range?: string };
      const data = await this.analyticsService.getGrowthMetrics(range || '30d');
      return ApiResponseHelper.success(reply, 'Growth metrics retrieved successfully', data);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }
}

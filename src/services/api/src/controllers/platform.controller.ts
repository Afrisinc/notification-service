import type { FastifyReply, FastifyRequest } from 'fastify';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponseHelper } from '../utils';
import { getErrorMessage } from '../utils/errorHandler';

export class PlatformController {
  private readonly analyticsService: AnalyticsService;

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

  async getAllUsers(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 10 } = req.query as { page?: number; limit?: number };
      const result = await this.analyticsService.getAllUsersWithDetails(page, limit);
      return ApiResponseHelper.successList(reply, 'All users retrieved successfully', result.data, result.meta);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }

  async getUserById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const data = await this.analyticsService.getUserWithDetails(userId);

      if (!data) {
        return ApiResponseHelper.notFound(reply, 'User not found');
      }

      return ApiResponseHelper.success(reply, 'User retrieved successfully', data);
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }

  async getCreditTransactions(req: FastifyRequest, reply: FastifyReply) {
    try {
      const query = req.query as {
        page?: string;
        limit?: string;
        accountId?: string;
        type?: string;
        channel?: string;
        dateFrom?: string;
        dateTo?: string;
        minAmount?: string;
        maxAmount?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = query.page ? Math.max(1, Number.parseInt(query.page, 10)) : 1;
      const limit = query.limit ? Math.min(100, Math.max(1, Number.parseInt(query.limit, 10))) : 50;

      const result = await this.analyticsService.getCreditTransactions({
        page,
        limit,
        accountId: query.accountId,
        type: query.type,
        channel: query.channel,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        minAmount: query.minAmount ? Number.parseFloat(query.minAmount) : undefined,
        maxAmount: query.maxAmount ? Number.parseFloat(query.maxAmount) : undefined,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return ApiResponseHelper.successList(
        reply,
        'Credit transactions retrieved successfully',
        result.data,
        result.meta
      );
    } catch (err: unknown) {
      return ApiResponseHelper.badRequest(reply, getErrorMessage(err));
    }
  }
}

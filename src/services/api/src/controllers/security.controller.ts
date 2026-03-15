import type { FastifyReply, FastifyRequest } from 'fastify';
import { SecurityService } from '../services/security.service';
import { ApiResponseHelper } from '../utils';
import { getErrorMessage } from '../utils/errorHandler';

export class SecurityController {
  private service: SecurityService;

  constructor() {
    this.service = new SecurityService();
  }

  async getSecurityOverview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        range = '24h',
        limit = 5,
        failed_login_limit = 10,
      } = req.query as {
        range?: '24h' | '7d' | '30d';
        limit?: number;
        failed_login_limit?: number;
      };

      // Validate range parameter
      const validRanges = ['24h', '7d', '30d'];
      if (!validRanges.includes(range)) {
        return ApiResponseHelper.badRequest(reply, 'Invalid range parameter. Must be one of: 24h, 7d, 30d');
      }

      // Validate numeric parameters
      const limitNum = Math.max(1, Math.min(limit || 5, 50));
      const failedLoginLimitNum = Math.max(1, Math.min(failed_login_limit || 10, 100));

      const result = await this.service.getSecurityOverview({
        range: range as '24h' | '7d' | '30d',
        limit: limitNum,
        failed_login_limit: failedLoginLimitNum,
      });

      return ApiResponseHelper.success(reply, 'Security overview retrieved successfully', result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      return ApiResponseHelper.badRequest(reply, message);
    }
  }

  async getLoginEvents(req: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = 'desc',
      } = req.query as {
        page?: number;
        limit?: number;
        search?: string;
        sortBy?: 'asc' | 'desc';
      };

      // Validate pagination parameters
      const pageNum = Math.max(1, Math.min(page || 1, 10000));
      const limitNum = Math.max(1, Math.min(limit || 10, 100));

      const result = await this.service.getLoginEvents({
        page: pageNum,
        limit: limitNum,
        search: search?.trim(),
        sortBy,
      });

      return ApiResponseHelper.success(reply, 'Login events retrieved successfully', result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      return ApiResponseHelper.badRequest(reply, message);
    }
  }
}

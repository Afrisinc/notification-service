/**
 * Dashboard Controller
 * HTTP request handlers for dashboard endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardService } from '../services/dashboard.service';
import { ApiResponseHelper } from '../utils';
import { logger } from '../config/logger';
import { DashboardPeriod } from '../types/dashboard.types';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

/**
 * GET /dashboard
 * Retrieves all dashboard data in a single request
 */
export async function getDashboard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const query = req.query as {
      period?: string;
      timezone?: string;
    };

    const period = (query.period || '7d') as DashboardPeriod;
    const timezone = query.timezone || 'UTC';

    // Validate period
    if (!['24h', '7d', '30d', '90d'].includes(period)) {
      return ApiResponseHelper.badRequest(reply, `Invalid period value. Allowed: 24h, 7d, 30d, 90d`);
    }

    const data = await dashboardService.getDashboard(period, timezone);

    return reply.status(200).send({
      success: true,
      resp_msg: 'Dashboard data retrieved successfully',
      resp_code: 1000,
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        period,
        timezone,
      },
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to get dashboard data');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve dashboard data');
  }
}

/**
 * GET /dashboard/stats
 * Retrieves only stats cards for real-time polling
 */
export async function getDashboardStats(req: FastifyRequest, reply: FastifyReply) {
  try {
    const query = req.query as {
      period?: string;
    };

    const period = (query.period || '7d') as DashboardPeriod;

    // Validate period
    if (!['24h', '7d', '30d', '90d'].includes(period)) {
      return ApiResponseHelper.badRequest(reply, `Invalid period value. Allowed: 24h, 7d, 30d, 90d`);
    }

    const stats = await dashboardService.getStats(period);

    return reply.status(200).send({
      success: true,
      resp_msg: 'Dashboard stats retrieved successfully',
      resp_code: 1000,
      data: stats,
      meta: {
        generatedAt: new Date().toISOString(),
        period,
      },
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to get dashboard stats');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve dashboard stats');
  }
}

/**
 * GET /dashboard/recent-sends
 * Retrieves recent notification activity with pagination
 */
export async function getRecentSends(req: FastifyRequest, reply: FastifyReply) {
  try {
    const query = req.query as {
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return ApiResponseHelper.badRequest(reply, 'Invalid limit value. Must be between 1 and 50');
    }

    // Validate offset
    if (isNaN(offset) || offset < 0) {
      return ApiResponseHelper.badRequest(reply, 'Invalid offset value. Must be 0 or greater');
    }

    const data = await dashboardService.getRecentSends(limit, offset);

    return reply.status(200).send({
      success: true,
      resp_msg: 'Recent sends retrieved successfully',
      resp_code: 1000,
      data,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to get recent sends');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve recent sends');
  }
}

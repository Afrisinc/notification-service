import { ApiResponseHelper } from './../utils/api-response';
import { FastifyRequest, FastifyReply } from 'fastify';
import { clientsService } from '../services/clients.service';
import { logger } from '../config/logger';
import { ListClientsQueryDTO } from '../dtos/clients';
import { InvalidDateRangeError } from '../utils/date-range';
import type { ClientsStatsPeriod } from '../types/clients-stats.types';

export class ClientsController {
  async getClients(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;
      const queryParams: ListClientsQueryDTO = {
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
        search: query.search,
        status: query.status as any,
        plan: query.plan as any,
      };

      const result = await clientsService.getAllClients(queryParams);

      return ApiResponseHelper.successList(reply, 'Clients retrieved successfully', result.data, result.meta);
    } catch (error) {
      logger.error({ error }, 'Failed to get clients');
      return ApiResponseHelper.error(reply, 'Failed to retrieve clients');
    }
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as Record<string, string | undefined>;

      const stats = await clientsService.getStats({
        period: query.period as ClientsStatsPeriod | undefined,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      return ApiResponseHelper.success(reply, 'Client stats retrieved successfully', stats);
    } catch (error) {
      if (error instanceof InvalidDateRangeError) {
        return ApiResponseHelper.badRequest(reply, error.message);
      }
      logger.error({ error }, 'Failed to get client stats');
      return ApiResponseHelper.internalError(reply, 'Failed to retrieve client stats');
    }
  }
}

export const clientsController = new ClientsController();

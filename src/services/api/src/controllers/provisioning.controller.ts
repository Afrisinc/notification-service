import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { provisioningService } from '../services/provisioning.service';
import { ApiResponseHelper } from '../utils';

export class ProvisioningController {
  /**
   * Provision a new tenant with default roles and templates
   * Internal endpoint - not exposed on Swagger
   */
  async provision(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { account_id, account_type } = request.body as {
        account_id: string;
        account_type: 'INDIVIDUAL' | 'ORGANIZATION';
      };

      if (!account_id || !account_type) {
        return ApiResponseHelper.badRequest(reply, 'Missing required fields: account_id, account_type');
      }

      const result = await provisioningService.provision({
        accountId: account_id,
        accountType: account_type,
      });

      logger.info({ resourceId: result.resource_id, accountId: account_id }, 'Tenant provisioned successfully');

      return ApiResponseHelper.created(reply, 'Tenant provisioned successfully', {
        resource_id: result.resource_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to provision tenant');

      if (errorMessage.includes('already exists')) {
        return ApiResponseHelper.duplicate(reply, errorMessage);
      }

      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
  }
}

export const provisioning = new ProvisioningController();

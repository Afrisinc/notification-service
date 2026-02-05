import { FastifyRequest } from 'fastify';
import { logger } from '../config/logger';

export interface Tenant {
  id: string;
  name: string;
  active: boolean;
}

// Mock tenant repository - replace with actual DB calls
const tenants: Map<string, Tenant> = new Map([
  ['afrisinc-auth', { id: 'afrisinc-auth', name: 'Afrisinc Auth', active: true }],
  ['afrisinc-internal', { id: 'afrisinc-internal', name: 'Afrisinc Internal', active: true }],
]);

export class TenantService {
  async resolveTenant(request: FastifyRequest): Promise<Tenant> {
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      const error = new Error('Missing x-tenant-id header');
      logger.error({ error }, 'Tenant ID header missing');
      throw error;
    }

    const tenant = tenants.get(tenantId);

    if (!tenant) {
      const error = new Error(`Tenant not found: ${tenantId}`);
      logger.error({ tenantId }, 'Tenant not found');
      throw error;
    }

    if (!tenant.active) {
      const error = new Error(`Tenant is inactive: ${tenantId}`);
      logger.error({ tenantId }, 'Tenant is inactive');
      throw error;
    }

    return tenant;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    return tenants.get(tenantId) || null;
  }

  async validateTenantAccess(tenantId: string, resourceTenantId: string): Promise<boolean> {
    return tenantId === resourceTenantId;
  }
}

export const tenantService = new TenantService();

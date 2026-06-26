/**
 * Data Transfer Object for listing clients query parameters
 */
export interface ListClientsQueryDTO {
  limit?: number;
  offset?: number;
  search?: string;
  status?: 'active' | 'suspended' | 'trial';
  plan?: 'FREE' | 'STARTER' | 'SCALE' | 'ENTERPRISE' | 'PAYG';
}

/**
 * Data Transfer Object for a Client (Account)
 */
export interface ClientDTO {
  id: number;
  name: string;
  plan: 'FREE' | 'STARTER' | 'SCALE' | 'ENTERPRISE' | 'PAYG';
  email: string;
  sent: string;
  deliveryRate: string;
  templates: number;
  status: 'active' | 'suspended' | 'trial';
  joined: string;
  channels: string[];
  organizationName: string;
  organizationType: 'INDIVIDUAL' | 'ORGANIZATION';
}

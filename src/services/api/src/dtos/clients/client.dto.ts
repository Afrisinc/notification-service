/**
 * Data Transfer Object for Organization within a Client
 */
export interface OrganizationAccountDTO {
  id: number;
  name: string;
  plan: 'FREE' | 'STARTER' | 'SCALE' | 'ENTERPRISE' | 'PRO' | 'PAYG';
  role: 'owner' | 'member' | 'admin';
  sent: string;
  templates: number;
  status: 'active' | 'suspended' | 'trial';
  joined: string;
}

/**
 * Data Transfer Object for a Client (User with Organizations)
 */
export interface ClientDTO {
  id: string;
  name: string;
  email: string;
  organizations: OrganizationAccountDTO[];
  stats: {
    totalOrganizations: number;
    ownedOrganizations: number;
    memberOrganizations: number;
    aggregatedStats: {
      sent: string;
      templates: number;
      deliveryRate: string;
    };
  };
}

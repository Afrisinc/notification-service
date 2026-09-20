import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

const orgIdParam = {
  type: 'object',
  required: ['orgId'],
  properties: { orgId: { type: 'string' } },
};

const domainIdParam = {
  type: 'object',
  required: ['orgId', 'domainId'],
  properties: { orgId: { type: 'string' }, domainId: { type: 'string' } },
};

const senderIdParam = {
  type: 'object',
  required: ['orgId', 'senderId'],
  properties: { orgId: { type: 'string' }, senderId: { type: 'string' } },
};

const senderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    localPart: { type: 'string' },
    fromName: { type: 'string' },
    replyToEmail: { type: 'string' },
    replyToName: { type: 'string' },
    isActive: { type: 'boolean' },
    assignedUserId: { type: ['string', 'null'] },
    address: { type: 'string' },
    domainId: { type: 'string' },
    createdAt: { type: 'string' },
  },
};

const domainSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    domain: { type: 'string' },
    selector: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'verified', 'suspended'] },
    spfVerified: { type: 'boolean' },
    dkimVerified: { type: 'boolean' },
    dmarcVerified: { type: 'boolean' },
    verifiedAt: { type: 'string' },
    cloudflareConnected: { type: 'boolean' },
    inboundEnabled: { type: 'boolean' },
    mxVerified: { type: 'boolean' },
    createdAt: { type: 'string' },
    senders: { type: 'array', items: senderSchema },
  },
};

export const ListOrgDomainsSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'List every custom domain owned directly by the organization',
  params: orgIdParam,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: domainSchema } },
    },
  },
};

export const AddOrgDomainSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Register a new custom domain for the organization (owner only)',
  params: orgIdParam,
  body: {
    type: 'object',
    required: ['domain'],
    properties: {
      domain: { type: 'string' },
      selector: { type: 'string' },
      cloudflareApiToken: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            domain: domainSchema,
            cloudflare: { type: ['object', 'null'] },
            usedOrgDefault: { type: 'boolean' },
          },
        },
      },
    },
  },
};

const cloudflareSettingsSchema = {
  type: 'object',
  properties: { connected: { type: 'boolean' } },
};

export const GetOrgCloudflareSettingsSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Check whether the organization has a default Cloudflare API token configured (owner only)',
  params: orgIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: cloudflareSettingsSchema } } },
};

export const UpdateOrgCloudflareSettingsSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description:
    'Set the organization default Cloudflare API token - used to auto-configure DNS for any domain added without its own token (owner only)',
  params: orgIdParam,
  body: {
    type: 'object',
    required: ['cloudflareApiToken'],
    properties: {
      cloudflareApiToken: {
        type: 'string',
        description: 'Cloudflare API token with Zone:DNS:Edit access',
      },
    },
  },
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: cloudflareSettingsSchema } } },
};

export const DeleteOrgCloudflareSettingsSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: "Remove the organization's default Cloudflare API token (owner only)",
  params: orgIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: cloudflareSettingsSchema } } },
};

const dnsRecordEntrySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    value: { type: 'string' },
    verified: { type: 'boolean' },
  },
};

const domainDnsRecordsSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    spf: dnsRecordEntrySchema,
    dkim: dnsRecordEntrySchema,
    dmarc: dnsRecordEntrySchema,
  },
};

export const GetOrgDomainRecordsSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Get the manual DNS records needed to verify an organization domain',
  params: domainIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: domainDnsRecordsSchema } } },
};

export const VerifyOrgDomainSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Re-check SPF/DKIM/DMARC DNS records for an organization domain',
  params: domainIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: domainSchema } } },
};

const mxRecordSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    host: { type: 'string' },
    verified: { type: 'boolean' },
  },
};

export const GetOrgInboundMxRecordSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Get the MX record needed to enable inbound receiving for an organization domain',
  params: domainIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: mxRecordSchema } } },
};

export const EnableOrgInboundDomainSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description:
    'Enable inbound receiving for an organization domain - auto-configures the MX record via Cloudflare when a token is available (domain-specific or the organization default), otherwise leaves it for manual DNS entry',
  params: domainIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: { domain: domainSchema, cloudflareConfigured: { type: 'boolean' } },
        },
      },
    },
  },
};

export const DeleteOrgDomainSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Remove an organization domain and all of its senders',
  params: domainIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties } } },
};

export const AddOrgSenderSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Add a sender identity under an organization domain, optionally assigned to a member',
  params: domainIdParam,
  body: {
    type: 'object',
    required: ['localPart'],
    properties: {
      localPart: { type: 'string' },
      fromName: { type: 'string' },
      replyToEmail: { type: 'string' },
      replyToName: { type: 'string' },
      assignedUserId: { type: 'string' },
    },
  },
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: senderSchema } } },
};

export const UpdateOrgSenderSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Update a sender identity, including reassigning it to a different member',
  params: senderIdParam,
  body: {
    type: 'object',
    properties: {
      fromName: { type: 'string' },
      replyToEmail: { type: 'string' },
      replyToName: { type: 'string' },
      assignedUserId: { type: ['string', 'null'] },
    },
  },
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: senderSchema } } },
};

export const DeleteOrgSenderSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'Remove a sender identity',
  params: senderIdParam,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties } } },
};

export const ListMySendersSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'List sender identities the current member may send/reply as',
  params: orgIdParam,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: senderSchema } },
    },
  },
};

export const ListOrgSendersSchema: FastifySchema = {
  tags: ['Organization Domains'],
  description: 'List every sender identity in the organization (owner only)',
  params: orgIdParam,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: senderSchema } },
    },
  },
};

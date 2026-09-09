import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

const appIdParam = {
  type: 'object',
  required: ['appId'],
  properties: {
    appId: { type: 'string', description: 'App ID (UUID)' },
  },
};

const domainIdParam = {
  type: 'object',
  required: ['appId', 'domainId'],
  properties: {
    appId: { type: 'string', description: 'App ID (UUID)' },
    domainId: { type: 'string', description: 'Email domain ID (UUID)' },
  },
};

const senderIdParam = {
  type: 'object',
  required: ['appId', 'senderId'],
  properties: {
    appId: { type: 'string', description: 'App ID (UUID)' },
    senderId: { type: 'string', description: 'Email sender ID (UUID)' },
  },
};

const senderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    localPart: { type: 'string' },
    fromName: { type: 'string' },
    replyToEmail: { type: 'string' },
    replyToName: { type: 'string' },
    isDefault: { type: 'boolean' },
    isActive: { type: 'boolean' },
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
    createdAt: { type: 'string' },
    senders: { type: 'array', items: senderSchema },
  },
};

export const ListEmailDomainsSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'List all sending domains and their sender identities for an app',
  params: appIdParam,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: domainSchema } },
    },
  },
};

export const AddEmailDomainSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Add a new sending domain, optionally auto-configuring DNS via a Cloudflare API token',
  params: appIdParam,
  body: {
    type: 'object',
    required: ['domain'],
    properties: {
      domain: { type: 'string', description: 'Domain to send from, e.g. mail.acme.com' },
      selector: { type: 'string', description: 'DKIM selector (default: afrisinc)' },
      cloudflareApiToken: {
        type: 'string',
        description:
          'Optional Cloudflare API token with DNS edit access - if provided, records are created automatically',
      },
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
            cloudflare: {
              type: ['object', 'null'],
              properties: {
                success: { type: 'boolean' },
                zoneId: { type: 'string' },
                error: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

export const GetEmailDomainRecordsSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Get the manual DNS records needed to verify a domain',
  params: domainIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            spf: {
              type: 'object',
              properties: { name: { type: 'string' }, value: { type: 'string' }, verified: { type: 'boolean' } },
            },
            dkim: {
              type: 'object',
              properties: { name: { type: 'string' }, value: { type: 'string' }, verified: { type: 'boolean' } },
            },
            dmarc: {
              type: 'object',
              properties: { name: { type: 'string' }, value: { type: 'string' }, verified: { type: 'boolean' } },
            },
          },
        },
      },
    },
  },
};

export const VerifyEmailDomainSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Re-check SPF/DKIM/DMARC DNS records for a domain',
  params: domainIdParam,
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties, data: domainSchema } },
  },
};

export const DeleteEmailDomainSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Remove a sending domain and all of its senders',
  params: domainIdParam,
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

export const AddEmailSenderSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Add a sender identity under a domain',
  params: domainIdParam,
  body: {
    type: 'object',
    required: ['localPart'],
    properties: {
      localPart: { type: 'string', description: 'Part before the @, e.g. "hello" for hello@acme.com' },
      fromName: { type: 'string' },
      replyToEmail: { type: 'string' },
      replyToName: { type: 'string' },
    },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties, data: senderSchema } },
  },
};

export const UpdateEmailSenderSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Update a sender identity, or mark it as the app default',
  params: senderIdParam,
  body: {
    type: 'object',
    properties: {
      fromName: { type: 'string' },
      replyToEmail: { type: 'string' },
      replyToName: { type: 'string' },
      isDefault: { type: 'boolean' },
    },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties, data: senderSchema } },
  },
};

export const DeleteEmailSenderSchema: FastifySchema = {
  tags: ['Email Identities'],
  description: 'Remove a sender identity',
  params: senderIdParam,
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties } },
  },
};

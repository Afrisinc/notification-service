import { standardErrorResponses } from '../common/error-responses';

const dnsRecordObject = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['TXT'] },
    name: { type: 'string' },
    value: { type: 'string' },
    label: { type: 'string' },
    purpose: { type: 'string' },
  },
};

const domainObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    domain: { type: 'string' },
    fromName: { type: 'string' },
    fromEmail: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'verified', 'suspended'] },
    verified: {
      type: 'object',
      properties: {
        spf: { type: 'boolean' },
        dkim: { type: 'boolean' },
        dmarc: { type: 'boolean' },
      },
    },
    dnsRecords: {
      type: 'array',
      items: dnsRecordObject,
    },
    verifiedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const CreateDomainSchema = {
  description: 'Create a new custom email domain for an app',
  tags: ['Domains'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Custom domain (e.g., mail.example.com)',
      },
      fromName: {
        type: 'string',
        description: 'Display name for emails from this domain',
      },
      fromEmail: {
        type: 'string',
        format: 'email',
        description: 'From email address for this domain',
      },
    },
    required: ['domain', 'fromName', 'fromEmail'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            domain: { type: 'string' },
            status: { type: 'string' },
            dnsRecords: {
              type: 'array',
              items: dnsRecordObject,
            },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetDomainRecordsSchema = {
  description: 'Get DNS records for a domain',
  tags: ['Domains'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      domainId: { type: 'string', format: 'uuid', description: 'Domain ID' },
    },
    required: ['appId', 'domainId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: domainObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const VerifyDomainSchema = {
  description: 'Verify DNS records for a domain',
  tags: ['Domains'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      domainId: { type: 'string', format: 'uuid', description: 'Domain ID' },
    },
    required: ['appId', 'domainId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            verified: { type: 'boolean' },
            checks: {
              type: 'object',
              properties: {
                spf: { type: 'boolean' },
                dkim: { type: 'boolean' },
                dmarc: { type: 'boolean' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const UpdateDomainSchema = {
  description: 'Update domain from name and email',
  tags: ['Domains'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      domainId: { type: 'string', format: 'uuid', description: 'Domain ID' },
    },
    required: ['appId', 'domainId'],
  },
  body: {
    type: 'object',
    properties: {
      fromName: {
        type: 'string',
        description: 'New display name for emails',
      },
      fromEmail: {
        type: 'string',
        format: 'email',
        description: 'New from email address',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const DeleteDomainSchema = {
  description: 'Delete a custom domain',
  tags: ['Domains'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      domainId: { type: 'string', format: 'uuid', description: 'Domain ID' },
    },
    required: ['appId', 'domainId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

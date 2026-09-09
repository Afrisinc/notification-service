import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

const localPartParam = {
  type: 'object',
  required: ['localPart'],
  properties: {
    localPart: { type: 'string', description: 'Local part of the alias, e.g. "support" for support@afrisinc.com' },
  },
};

const aliasSchema = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    localPart: { type: 'string' },
    destinations: { type: 'array', items: { type: 'string' } },
  },
};

export const ListMailAliasesSchema: FastifySchema = {
  tags: ['Mail Aliases'],
  description: 'List all forwarding aliases configured on the mail server (/etc/postfix/virtual)',
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: { type: 'array', items: aliasSchema },
      },
    },
  },
};

export const AddMailAliasSchema: FastifySchema = {
  tags: ['Mail Aliases'],
  description: 'Add a new forwarding alias, e.g. sales@afrisinc.com -> team@gmail.com',
  body: {
    type: 'object',
    required: ['localPart', 'destinations'],
    properties: {
      localPart: { type: 'string', description: 'e.g. "sales" for sales@afrisinc.com' },
      destinations: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: aliasSchema,
      },
    },
  },
};

export const UpdateMailAliasSchema: FastifySchema = {
  tags: ['Mail Aliases'],
  description: 'Update the destinations for an existing forwarding alias',
  params: localPartParam,
  body: {
    type: 'object',
    required: ['destinations'],
    properties: {
      destinations: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...StandardResponseProperties,
        data: aliasSchema,
      },
    },
  },
};

export const DeleteMailAliasSchema: FastifySchema = {
  tags: ['Mail Aliases'],
  description: 'Delete a forwarding alias',
  params: localPartParam,
  response: {
    200: {
      type: 'object',
      properties: StandardResponseProperties,
    },
  },
};

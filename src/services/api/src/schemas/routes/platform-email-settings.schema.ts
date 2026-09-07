import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

const settingsSchema = {
  type: 'object',
  properties: {
    fromEmail: { type: 'string' },
    fromName: { type: 'string' },
    supportEmail: { type: ['string', 'null'] },
  },
};

export const GetPlatformEmailSettingsSchema: FastifySchema = {
  tags: ['Platform Settings'],
  description: 'Get the platform-wide default sender identity',
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties, data: settingsSchema } },
  },
};

export const UpdatePlatformEmailSettingsSchema: FastifySchema = {
  tags: ['Platform Settings'],
  description: 'Update the platform-wide default sender identity',
  body: {
    type: 'object',
    required: ['fromEmail', 'fromName'],
    properties: {
      fromEmail: { type: 'string', description: 'Default From email used when an app has no custom sender' },
      fromName: { type: 'string', description: 'Default From display name' },
      supportEmail: { type: 'string', description: 'Support contact email shown in system emails' },
    },
  },
  response: {
    200: { type: 'object', properties: { ...StandardResponseProperties, data: settingsSchema } },
  },
};

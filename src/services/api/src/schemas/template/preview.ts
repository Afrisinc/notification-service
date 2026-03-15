/**
 * Schema for POST /templates/preview endpoint
 * Render a template preview without storing notification
 */

import { templateHeaders } from '../common';

export const previewTemplateRequestBody = {
  type: 'object',
  required: ['templateCode', 'channel', 'locale', 'variables'],
  properties: {
    templateCode: {
      type: 'string',
      minLength: 1,
      description: 'Unique template code (e.g., WELCOME_EMAIL)',
    },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP'],
      description: 'Notification channel',
    },
    locale: {
      type: 'string',
      default: 'en',
      minLength: 2,
      maxLength: 5,
      description: "Language/locale code (ISO 639-1). Falls back to 'en' if not found.",
    },
    variables: {
      type: 'object',
      description: "Template variables to inject (e.g., {user: {name: 'John'}})",
      additionalProperties: true,
    },
  },
};

export const previewTemplateResponseBody = {
  type: 'object',
  properties: {
    subject: {
      type: ['string', 'null'],
      description: 'Rendered subject (only for EMAIL templates)',
    },
    content: {
      type: 'string',
      description: 'Rendered template content with variables injected',
    },
    locale: {
      type: 'string',
      description: 'Locale used for rendering (may differ from requested locale due to fallback)',
    },
    version: {
      type: 'integer',
      description: 'Version number of template used',
    },
  },
  required: ['content', 'locale', 'version'],
};

export const previewTemplateSchema = {
  description: 'Render a template preview with provided variables without sending',
  tags: ['Templates'],
  headers: templateHeaders,
  body: previewTemplateRequestBody,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: previewTemplateResponseBody,
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
      description: 'Missing required variables or invalid template syntax',
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
      description: 'Template not found',
    },
  },
};

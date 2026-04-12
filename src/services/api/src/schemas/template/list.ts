/**
 * Schema for GET /templates endpoint
 * List templates with filtering and pagination
 */

import { listResponse, paginationQueryParams, templateHeaders } from '../common';

export const templateListItem = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'Template ID' },
    slug: { type: 'string', description: 'Template slug (code)' },
    name: { type: 'string', description: 'Template name' },
    description: { type: 'string', description: 'Template description' },
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Notification channel',
    },
    category: {
      type: 'string',
      enum: ['AUTH', 'TRANSACTIONAL', 'MARKETING', 'NOTIFICATION'],
      description: 'Template category',
    },
    author: { type: 'string', description: 'Template author' },
    isFree: { type: 'boolean', description: 'Whether template is free' },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          example: { type: 'string' },
          required: { type: 'boolean' },
        },
      },
      description: 'Template variables',
    },
    subject: { type: 'string', description: 'Template subject' },
    content: { description: 'Template content' },
    language: { type: 'string', description: 'Template language' },
    version: { type: 'number', description: 'Template version' },
    active: { type: 'boolean', description: 'Whether template is active' },
    visibility: {
      type: 'string',
      enum: ['private', 'account', 'marketplace'],
      description: 'Template visibility scope',
    },
    isPublic: {
      type: 'boolean',
      description: 'Whether template is publicly available',
    },
    thumbnail: {
      type: ['string', 'null'],
      format: 'uri',
      description: 'URL to template thumbnail image',
    },
    previewImage: {
      type: ['string', 'null'],
      format: 'uri',
      description: 'URL to template preview image',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Template discovery tags',
    },
    pricing: {
      type: ['string', 'null'],
      enum: ['free', 'paid', null],
      description: 'Pricing model (free or paid)',
    },
    price: {
      type: ['number', 'null'],
      description: 'Price in USD for paid templates',
    },
    publishedAt: {
      type: ['string', 'null'],
      format: 'date-time',
      description: 'When template was published to marketplace',
    },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
  },
  required: ['id', 'slug', 'name', 'channel', 'category', 'author', 'isFree', 'variables'],
};

export const templateListQueryParams = {
  type: 'object',
  description: 'Filters for template list',
  properties: {
    channel: {
      type: 'string',
      enum: ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'],
      description: 'Filter by notification channel',
    },
    ...paginationQueryParams.properties,
  },
};

export const templateListResponseBody = listResponse(templateListItem);

export const listTemplatesSchema = {
  description: 'List templates with filtering and pagination',
  tags: ['Templates'],
  headers: templateHeaders,
  querystring: templateListQueryParams,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: templateListItem,
          description: 'List of templates',
        },
        meta: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
    401: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

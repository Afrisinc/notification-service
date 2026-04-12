/**
 * Publish template to marketplace schema
 */

export const publishTemplateRequestBody = {
  type: 'object',
  description: 'Publish template to marketplace',
  properties: {
    // Core metadata
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Template name/title for marketplace listing',
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Detailed description of what the template does',
    },
    category: {
      type: 'string',
      enum: ['AUTH', 'TRANSACTIONAL', 'MARKETING', 'NOTIFICATION'],
      description: 'Template category for filtering',
    },

    // Marketplace features
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 30,
      },
      maxItems: 5,
      description: 'Tags for discoverability (1-5 tags)',
    },
    thumbnail: {
      type: 'string',
      format: 'uri',
      description: 'Thumbnail image URL for marketplace preview',
    },
    previewImage: {
      type: 'string',
      format: 'uri',
      description: 'Preview image URL showing template rendering',
    },

    // Pricing
    pricing: {
      type: 'string',
      enum: ['free', 'paid'],
      description: 'Pricing model - free or paid',
    },
    price: {
      type: 'number',
      minimum: 0,
      maximum: 9999,
      description: 'Price in USD (only required if pricing is "paid")',
    },
  },
  additionalProperties: false,
};

export const publishTemplateResponseBody = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'Template ID' },
    code: { type: 'string', description: 'Template code' },
    title: { type: 'string', description: 'Template title' },
    channel: { type: 'string', description: 'Notification channel' },
    category: { type: 'string', description: 'Template category' },
    description: { type: 'string', description: 'Template description' },
    visibility: { type: 'string', enum: ['private', 'account', 'marketplace'], description: 'Template visibility' },
    isPublic: { type: 'boolean', description: 'Whether template is public' },
    pricing: { type: 'string', enum: ['free', 'paid'], description: 'Pricing model' },
    price: { type: 'number', description: 'Price in USD' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Marketplace tags',
    },
    thumbnail: { type: 'string', description: 'Thumbnail URL' },
    previewImage: { type: 'string', description: 'Preview image URL' },
    publishedAt: { type: 'string', format: 'date-time', description: 'Publish timestamp' },
  },
  required: ['id', 'code', 'channel', 'visibility', 'isPublic'],
};

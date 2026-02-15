export const createTemplateSchema = {
  type: "object",
  required: ["code", "channel", "content", "language"],
  properties: {
    code: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      pattern: "^[A-Z_]+$",
      description: "Template code identifier (uppercase with underscores)",
    },
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP"],
      description: "Notification channel",
    },
    subject: {
      type: "string",
      description: "Email subject (required for EMAIL channel)",
    },
    content: {
      type: "string",
      minLength: 1,
      description: "Template content with {{variable}} placeholders",
    },
    language: {
      type: "string",
      minLength: 2,
      maxLength: 5,
      description: "Language code (e.g., en, fr, es)",
    },
    description: {
      type: "string",
      description: "Template description",
    },
  },
};

export const templateResponseSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
    code: {
      type: "string",
    },
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP"],
    },
    subject: {
      type: "string",
    },
    content: {
      type: "string",
    },
    language: {
      type: "string",
    },
    active: {
      type: "boolean",
    },
    createdAt: {
      type: "string",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
    },
  },
};

export const templateListResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "array",
      items: templateResponseSchema,
    },
    meta: {
      type: "object",
      properties: {
        limit: { type: "integer" },
        offset: { type: "integer" },
        total: { type: "integer" },
      },
    },
  },
};

export const updateTemplateSchema = {
  type: "object",
  properties: {
    subject: {
      type: "string",
    },
    content: {
      type: "string",
      minLength: 1,
    },
    active: {
      type: "boolean",
    },
  },
};

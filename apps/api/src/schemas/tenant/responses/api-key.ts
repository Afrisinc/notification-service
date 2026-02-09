/**
 * API Key response schemas
 */

export const apiKeyBodySchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "API Key ID",
    },
    name: {
      type: "string",
      description: "API key name",
    },
    revoked: {
      type: "boolean",
      description: "Whether the key is revoked",
    },
    lastUsedAt: {
      type: ["string", "null"],
      format: "date-time",
      description: "Last usage timestamp",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "Creation timestamp",
    },
  },
};

export const createApiKeyResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    resp_msg: { type: "string" },
    resp_code: { type: "number" },
    data: {
      type: "object",
      properties: {
        id: { type: "string" },
        plainKey: {
          type: "string",
          description: "The plaintext API key (only shown once at creation)",
        },
        name: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        message: { type: "string" },
      },
    },
  },
};

export const listApiKeysResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    resp_msg: { type: "string" },
    resp_code: { type: "number" },
    data: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: apiKeyBodySchema,
        },
        count: { type: "integer" },
      },
    },
  },
};

export const revokeApiKeyResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    resp_msg: { type: "string" },
    resp_code: { type: "number" },
  },
};

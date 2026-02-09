/**
 * Common tenant schemas and shared definitions
 */

export const tenantIdParamSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Tenant ID",
    },
  },
  required: ["id"],
};

export const tenantPaginationSchema = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      default: 20,
      maximum: 100,
      description: "Number of records to return",
    },
    offset: {
      type: "integer",
      default: 0,
      minimum: 0,
      description: "Number of records to skip",
    },
  },
};

export const tenantBodySchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Tenant ID",
    },
    code: {
      type: "string",
      description: "Unique tenant code (e.g., afrisinc-auth)",
    },
    name: {
      type: "string",
      description: "Tenant display name",
    },
    status: {
      type: "string",
      enum: ["ACTIVE", "SUSPENDED"],
      description: "Tenant status",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "Creation timestamp",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "Last update timestamp",
    },
  },
};

export const metaSchema = {
  type: "object",
  properties: {
    limit: { type: "integer" },
    offset: { type: "integer" },
    total: { type: "integer" },
  },
};

export const standardResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    resp_msg: { type: "string" },
    resp_code: { type: "number" },
  },
};

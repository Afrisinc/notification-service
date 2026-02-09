/**
 * Common pagination and metadata schemas
 */

export const paginationMeta = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      description: "Number of items per page",
    },
    offset: {
      type: "integer",
      description: "Number of items to skip",
    },
    total: {
      type: "integer",
      description: "Total number of items",
    },
  },
  required: ["limit", "offset", "total"],
};

export const paginationQueryParams = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      description: "Items per page (max 100)",
      default: 20,
      maximum: 100,
      minimum: 1,
    },
    offset: {
      type: "integer",
      description: "Items to skip",
      default: 0,
      minimum: 0,
    },
  },
};

export const listResponse = (itemSchema: any) => ({
  type: "object",
  properties: {
    data: {
      type: "array",
      items: itemSchema,
      description: "List of items",
    },
    meta: paginationMeta,
  },
  required: ["data", "meta"],
});

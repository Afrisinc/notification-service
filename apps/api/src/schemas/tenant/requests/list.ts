/**
 * List tenants query string schema
 */

export const listTenantsQuerySchema = {
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

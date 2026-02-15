/**
 * Create tenant request schema
 */

export const createTenantRequestSchema = {
  type: "object",
  required: ["code", "name"],
  properties: {
    code: {
      type: "string",
      description: "Unique tenant code (e.g., afrisinc-auth)",
      minLength: 3,
      maxLength: 50,
      pattern: "^[a-z0-9-]+$",
      examples: ["afrisinc-core", "afrisinc-auth"],
    },
    name: {
      type: "string",
      description: "Tenant display name",
      minLength: 1,
      maxLength: 200,
      examples: ["Afrisinc Core", "Afrisinc Auth Service"],
    },
  },
};

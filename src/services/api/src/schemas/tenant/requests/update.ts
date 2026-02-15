/**
 * Update tenant request schema
 */

export const updateTenantRequestSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Tenant display name",
      minLength: 1,
      maxLength: 200,
    },
    status: {
      type: "string",
      enum: ["ACTIVE", "SUSPENDED"],
      description: "Tenant status",
    },
  },
};

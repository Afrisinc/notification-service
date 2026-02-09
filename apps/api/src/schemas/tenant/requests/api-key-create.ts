/**
 * Create API key request schema
 */

export const createApiKeyRequestSchema = {
  type: "object",
  required: ["name"],
  properties: {
    name: {
      type: "string",
      description: "API key name (e.g., auth-service, media-service)",
      minLength: 1,
      maxLength: 100,
      examples: ["auth-service", "notification-worker"],
    },
  },
};

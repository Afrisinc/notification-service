/**
 * List API keys query string schema
 */

export const listApiKeysQuerySchema = {
  type: "object",
  properties: {
    includeRevoked: {
      type: "string",
      enum: ["true", "false"],
      default: "false",
      description: "Include revoked API keys in response",
    },
  },
};

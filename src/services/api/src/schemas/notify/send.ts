/**
 * Schema for POST /notify/send endpoint
 * Send a single notification
 *
 * ⚠️  IMPORTANT: Template Code Format Requirements
 * The templateCode field must match the pattern: ^[A-Z_]+$
 * - Only UPPERCASE letters (A-Z) and underscores (_) allowed
 * - No lowercase, hyphens, spaces, or numbers
 *
 * Valid examples:
 * - WELCOME_EMAIL
 * - VERIFY_EMAIL
 * - ORDER_CONFIRMATION
 * - PASSWORD_RESET
 *
 * Invalid examples (will return 400 Bad Request):
 * - welcome-email (lowercase with hyphen)
 * - Welcome Email (spaces and mixed case)
 * - verify_email (lowercase)
 */

export const sendNotificationRequestBody = {
  type: "object",
  description: "Request to send a single notification",
  required: ["channel", "recipient", "templateCode", "payload"],
  properties: {
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP", "PUSH", "WHATSAPP"],
      description: "Notification channel",
    },
    recipient: {
      type: "string",
      minLength: 1,
      description: "Recipient email, phone number, or user ID",
    },
    templateCode: {
      type: "string",
      minLength: 1,
      pattern: "^[A-Z_]+$",
      description: "Template code identifier. Must contain only uppercase letters (A-Z) and underscores (_). Examples: WELCOME_EMAIL, VERIFY_EMAIL, ORDER_CONFIRMATION",
      examples: ["WELCOME_EMAIL", "VERIFY_EMAIL"],
    },
    payload: {
      type: "object",
      description: "Dynamic variables for template interpolation",
    },
    priority: {
      type: "string",
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
      description: "Notification priority level",
    },
  },
};

export const sendNotificationResponseBody = {
  type: "object",
  properties: {
    notificationId: {
      type: "string",
      format: "uuid",
      description: "Unique notification identifier",
    },
    status: {
      type: "string",
      enum: ["PENDING", "QUEUED", "SENT", "FAILED"],
      description: "Current notification status",
    },
  },
  required: ["notificationId", "status"],
};

export const sendNotificationSchema = {
  description: "Send a single notification",
  tags: ["Notifications"],
  body: sendNotificationRequestBody,
  response: {
    202: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
        data: sendNotificationResponseBody,
      },
    },
    400: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
      },
    },
    401: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
      },
    },
    404: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
      },
    },
  },
};

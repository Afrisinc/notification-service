/**
 * Schema for GET /notify/:id endpoint
 * Retrieve notification status
 */

export const notificationStatusResponseBody = {
  type: "object",
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "Unique notification identifier",
    },
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP", "PUSH", "WHATSAPP"],
      description: "Notification channel",
    },
    recipient: {
      type: "string",
      description: "Recipient address or identifier",
    },
    status: {
      type: "string",
      enum: ["PENDING", "QUEUED", "SENT", "FAILED"],
      description: "Current notification status",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "When the notification was created",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "When the notification was last updated",
    },
  },
  required: ["id", "channel", "recipient", "status", "createdAt", "updatedAt"],
};

export const notificationStatusSchema = {
  description: "Get notification status by ID",
  tags: ["Notifications"],
  params: {
    type: "object",
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Notification ID",
      },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
        data: notificationStatusResponseBody,
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
    403: {
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

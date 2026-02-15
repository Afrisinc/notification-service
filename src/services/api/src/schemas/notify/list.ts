/**
 * Schema for GET /notify/logs endpoint
 * List notifications with filters and pagination
 */

import { notificationStatusResponseBody } from "./status";
import { listResponse, paginationQueryParams } from "../common";

export const notificationListQueryParams = {
  type: "object",
  description: "Filters for notification list",
  properties: {
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP", "PUSH", "WHATSAPP"],
      description: "Filter by notification channel",
    },
    status: {
      type: "string",
      enum: ["PENDING", "QUEUED", "SENT", "FAILED"],
      description: "Filter by notification status",
    },
    ...paginationQueryParams.properties,
  },
};

export const notificationListResponseBody = listResponse(
  notificationStatusResponseBody,
);

export const notificationListSchema = {
  description: "List notifications with filtering and pagination",
  tags: ["Notifications"],
  querystring: notificationListQueryParams,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
        data: notificationListResponseBody,
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
  },
};

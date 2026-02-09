/**
 * Schema for GET /templates endpoint
 * List templates with filtering and pagination
 */

import { listResponse, paginationQueryParams, templateHeaders } from "../common";

export const templateListItem = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "Template ID" },
    code: { type: "string", description: "Template code" },
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP", "PUSH", "WHATSAPP"],
      description: "Notification channel",
    },
    subject: {
      type: "string",
      description: "Email subject (for EMAIL channel)",
    },
    language: { type: "string", description: "Language code" },
    active: { type: "boolean", description: "Whether template is active" },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "When template was created",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "When template was last updated",
    },
  },
  required: [
    "id",
    "code",
    "channel",
    "language",
    "active",
    "createdAt",
    "updatedAt",
  ],
};

export const templateListQueryParams = {
  type: "object",
  description: "Filters for template list",
  properties: {
    channel: {
      type: "string",
      enum: ["EMAIL", "SMS", "IN_APP", "PUSH", "WHATSAPP"],
      description: "Filter by notification channel",
    },
    ...paginationQueryParams.properties,
  },
};

export const templateListResponseBody = listResponse(templateListItem);

export const listTemplatesSchema = {
  description: "List templates with filtering and pagination",
  tags: ["Templates"],
  headers: templateHeaders,
  querystring: templateListQueryParams,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        resp_msg: { type: "string" },
        resp_code: { type: "number" },
        data: templateListResponseBody,
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

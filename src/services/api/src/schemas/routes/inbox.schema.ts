import { FastifySchema } from 'fastify';

const StandardResponseProperties = {
  success: { type: 'boolean' },
  resp_msg: { type: 'string' },
  resp_code: { type: 'number' },
};

const paginationQuery = {
  type: 'object',
  properties: {
    page: { type: 'string' },
    pageSize: { type: 'string' },
  },
};

const attachmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    filename: { type: 'string' },
    contentType: { type: 'string' },
    sizeBytes: { type: 'number' },
    url: { type: 'string' },
  },
};

const messageSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    direction: { type: 'string', enum: ['inbound', 'outbound'] },
    fromAddress: { type: 'string' },
    toAddresses: { type: 'array', items: { type: 'string' } },
    ccAddresses: { type: 'array', items: { type: 'string' } },
    subject: { type: 'string' },
    textBody: { type: 'string' },
    htmlBody: { type: 'string' },
    createdAt: { type: 'string' },
    attachments: { type: 'array', items: attachmentSchema },
  },
};

const threadSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    appId: { type: 'string' },
    appName: { type: 'string' },
    domain: { type: 'string' },
    contactEmail: { type: 'string' },
    subject: { type: 'string' },
    status: { type: 'string', enum: ['open', 'closed'] },
    lastMessageAt: { type: 'string' },
  },
};

const threadDetailSchema = {
  type: 'object',
  properties: {
    ...threadSummarySchema.properties,
    messages: { type: 'array', items: messageSchema },
  },
};

const replyBody = {
  type: 'object',
  required: ['body'],
  properties: {
    body: { type: 'string' },
    html: { type: 'string' },
    cc: { type: 'array', items: { type: 'string', format: 'email' } },
  },
};

export const ListOrgThreadsSchema: FastifySchema = {
  tags: ['Business Inbox'],
  description: 'List email threads across every app/domain in an organization',
  params: { type: 'object', required: ['orgId'], properties: { orgId: { type: 'string' } } },
  querystring: paginationQuery,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: threadSummarySchema } },
    },
  },
};

export const GetOrgThreadSchema: FastifySchema = {
  tags: ['Business Inbox'],
  description: 'Get a thread and its messages',
  params: {
    type: 'object',
    required: ['orgId', 'threadId'],
    properties: { orgId: { type: 'string' }, threadId: { type: 'string' } },
  },
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: threadDetailSchema } } },
};

export const ComposeOrgThreadSchema: FastifySchema = {
  tags: ['Business Inbox'],
  description: "Start a new email thread to an arbitrary address using one of the organization's sender identities",
  params: { type: 'object', required: ['orgId'], properties: { orgId: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['senderId', 'to', 'subject', 'body'],
    properties: {
      senderId: { type: 'string' },
      to: { type: 'string', format: 'email' },
      cc: { type: 'array', items: { type: 'string', format: 'email' } },
      subject: { type: 'string' },
      body: { type: 'string' },
      html: { type: 'string' },
    },
  },
  response: { 201: { type: 'object', properties: { ...StandardResponseProperties, data: threadDetailSchema } } },
};

export const ReplyToOrgThreadSchema: FastifySchema = {
  tags: ['Business Inbox'],
  description: 'Reply to a thread as the app that owns it, sent to the external recipient',
  params: {
    type: 'object',
    required: ['orgId', 'threadId'],
    properties: { orgId: { type: 'string' }, threadId: { type: 'string' } },
  },
  body: replyBody,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: messageSchema } } },
};

export const ListMyThreadsSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'List every thread addressed to the logged-in recipient, across all businesses',
  querystring: paginationQuery,
  response: {
    200: {
      type: 'object',
      properties: { ...StandardResponseProperties, data: { type: 'array', items: threadSummarySchema } },
    },
  },
};

export const GetMyThreadSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Get a thread and its messages',
  params: { type: 'object', required: ['threadId'], properties: { threadId: { type: 'string' } } },
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: threadDetailSchema } } },
};

export const ReplyToMyThreadSchema: FastifySchema = {
  tags: ['Recipient Mail Portal'],
  description: 'Reply to a thread as the logged-in recipient',
  params: { type: 'object', required: ['threadId'], properties: { threadId: { type: 'string' } } },
  body: replyBody,
  response: { 200: { type: 'object', properties: { ...StandardResponseProperties, data: messageSchema } } },
};

import { standardErrorResponses } from '../common/error-responses';

const campaignObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    appId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'] },
    templateId: { type: 'string', format: 'uuid' },
    recipientType: { type: 'string', enum: ['all', 'tags', 'segment', 'custom'] },
    recipientCount: { type: 'integer' },
    status: { type: 'string', enum: ['draft', 'scheduled', 'completed', 'cancelled'] },
    sentCount: { type: 'integer' },
    deliveredCount: { type: 'integer' },
    failedCount: { type: 'integer' },
    scheduledAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const ListCampaignsSchema = {
  description: 'List all campaigns for an app with pagination, filtering, and sorting',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', default: 1, description: 'Page number' },
      limit: { type: 'integer', default: 20, maximum: 100, description: 'Items per page' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'completed', 'cancelled'] },
      channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'] },
      sortBy: { type: 'string', enum: ['name', 'createdAt', 'status', 'sentCount'], default: 'createdAt' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            appId: { type: 'string', format: 'uuid' },
            campaigns: { type: 'array', items: campaignObject },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const CreateCampaignSchema = {
  description: 'Create a new campaign',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Campaign name (required)' },
      channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'], description: 'Channel (required)' },
      templateId: { type: 'string', format: 'uuid', description: 'Template ID (required)' },
      recipientType: { type: 'string', enum: ['all', 'tags', 'segment', 'custom'], default: 'all' },
      recipientCount: { type: 'integer', default: 0 },
      recipientTags: { type: 'array', items: { type: 'string' } },
      recipientSegment: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'completed'], default: 'draft' },
      scheduledAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object' },
    },
    required: ['name', 'channel', 'templateId'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: campaignObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetCampaignSchema = {
  description: 'Get a single campaign by ID',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: campaignObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const UpdateCampaignSchema = {
  description: 'Update a campaign',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      recipientType: { type: 'string', enum: ['all', 'tags', 'segment', 'custom'] },
      recipientCount: { type: 'integer' },
      recipientTags: { type: 'array', items: { type: 'string' } },
      recipientSegment: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'completed', 'cancelled'] },
      scheduledAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: campaignObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const DeleteCampaignSchema = {
  description: 'Delete a campaign',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            deletedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const SendCampaignSchema = {
  description: 'Send/execute a campaign',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  body: {
    type: 'object',
    properties: {
      dryRun: { type: 'boolean', default: false, description: 'Simulate send without actually sending' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            campaignId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            sentCount: { type: 'integer' },
            failedCount: { type: 'integer' },
            sentAt: { type: 'string', format: 'date-time' },
            estimatedDeliveryTime: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const ScheduleCampaignSchema = {
  description: 'Schedule a campaign for future delivery',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  body: {
    type: 'object',
    properties: {
      scheduledAt: { type: 'string', format: 'date-time', description: 'Future timestamp (required)' },
    },
    required: ['scheduledAt'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: campaignObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const DuplicateCampaignSchema = {
  description: 'Clone a campaign with a new name',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  body: {
    type: 'object',
    properties: {
      newName: { type: 'string', description: 'Name for duplicated campaign (required)' },
    },
    required: ['newName'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: campaignObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetCampaignStatsSchema = {
  description: 'Get detailed statistics for a campaign',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      campaignId: { type: 'string', format: 'uuid', description: 'Campaign ID' },
    },
    required: ['appId', 'campaignId'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            campaignId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: { type: 'string' },
            sentAt: { type: ['string', 'null'], format: 'date-time' },
            stats: { type: 'object' },
            rates: { type: 'object' },
            timeline: { type: 'object' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetCampaignsSummaryStatsSchema = {
  description: 'Get aggregate statistics for all campaigns',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'scheduled', 'completed', 'cancelled'] },
      channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'] },
      dateFrom: { type: 'string', format: 'date-time', description: 'Filter start date (default: 30 days ago)' },
      dateTo: { type: 'string', format: 'date-time', description: 'Filter end date (default: today)' },
    },
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID' },
    },
    required: ['x-account-id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            appId: { type: 'string', format: 'uuid' },
            period: { type: 'object' },
            summary: { type: 'object' },
            byChannel: { type: 'object' },
            topCampaigns: { type: 'array' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

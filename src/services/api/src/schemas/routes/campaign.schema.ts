import { standardErrorResponses } from '../common/error-responses';

const campaignObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    appId: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] },

    // Template mode
    templateId: { type: ['string', 'null'], format: 'uuid' },

    // EMAIL content
    subject: { type: ['string', 'null'] },
    htmlContent: { type: ['string', 'null'] },

    // SMS content
    textContent: { type: ['string', 'null'] },

    // PUSH content
    pushTitle: { type: ['string', 'null'] },
    pushBody: { type: ['string', 'null'] },
    pushImageUrl: { type: ['string', 'null'] },
    pushActionUrl: { type: ['string', 'null'] },
    pushData: { type: ['object', 'null'] },

    // IN_APP content
    inappTitle: { type: ['string', 'null'] },
    inappBody: { type: ['string', 'null'] },
    inappImageUrl: { type: ['string', 'null'] },
    inappActionUrl: { type: ['string', 'null'] },
    inappActionText: { type: ['string', 'null'] },

    // Common fields
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
      channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] },
      sortBy: { type: 'string', enum: ['name', 'createdAt', 'status', 'sentCount'], default: 'createdAt' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    },
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

// Shared by both create-campaign routes (with and without :appId in the URL)
// so the body contract stays identical regardless of how the app is resolved.
const createCampaignBody = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Campaign name (required)' },
    channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'], description: 'Channel (required)' },

    // App resolution for routes with no :appId in the URL (see CreateCampaignSdkSchema).
    // Required when authenticating with a JWT; ignored when using an API key or the
    // /apps/:appId/campaigns path, since the app is already known in those cases.
    app_id: {
      type: 'string',
      format: 'uuid',
      description: 'App ID (required only for the param-less SDK route + JWT auth)',
    },

    // Template mode (optional - use this OR direct content)
    templateId: { type: 'string', format: 'uuid', description: 'Template ID (use template mode)' },

    // EMAIL direct content
    subject: { type: 'string', description: 'Email subject (EMAIL channel)' },
    html_content: { type: 'string', description: 'Email HTML body (EMAIL channel)' },

    // SMS direct content
    text_content: { type: 'string', description: 'SMS text message (SMS channel)' },

    // PUSH direct content
    push_title: { type: 'string', description: 'Push notification title (PUSH channel)' },
    push_body: { type: 'string', description: 'Push notification body (PUSH channel)' },
    push_image_url: { type: 'string', description: 'Push image URL (PUSH channel)' },
    push_action_url: { type: 'string', description: 'Push action URL (PUSH channel)' },
    push_data: { type: 'object', description: 'Push custom data payload (PUSH channel)' },

    // IN_APP direct content
    inapp_title: { type: 'string', description: 'In-app title (IN_APP channel)' },
    inapp_body: { type: 'string', description: 'In-app body (IN_APP channel)' },
    inapp_image_url: { type: 'string', description: 'In-app image URL (IN_APP channel)' },
    inapp_action_url: { type: 'string', description: 'In-app action URL (IN_APP channel)' },
    inapp_action_text: { type: 'string', description: 'In-app CTA button text (IN_APP channel)' },

    // Recipient targeting
    recipientType: { type: 'string', enum: ['all', 'tags', 'segment', 'custom'], default: 'all' },
    recipientCount: { type: 'integer', default: 0 },
    recipientTags: { type: 'array', items: { type: 'string' } },
    recipientSegment: { type: 'string' },

    // Campaign settings
    status: { type: 'string', enum: ['draft', 'scheduled'], default: 'draft' },
    scheduledAt: { type: 'string', format: 'date-time' },
    metadata: { type: 'object' },
  },
  required: ['name', 'channel'],
};

const createCampaignResponse = {
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
};

export const CreateCampaignSchema = {
  description:
    'Create a new campaign. Use templateId for template mode, or provide channel-specific content for direct mode.',
  tags: ['Campaigns'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
    },
    required: ['appId'],
  },
  body: createCampaignBody,
  response: createCampaignResponse,
  security: [{ bearerAuth: [] }],
};

export const CreateCampaignSdkSchema = {
  description:
    'Create a new campaign without an appId in the URL. The app is resolved from the API key used, ' +
    'or from `app_id` in the body when authenticating with a JWT (same contract as /notify/send).',
  tags: ['Campaigns'],
  body: createCampaignBody,
  response: createCampaignResponse,
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
  description: 'Update a campaign (only draft campaigns can have content modified)',
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

      // EMAIL direct content
      subject: { type: 'string', description: 'Email subject' },
      html_content: { type: 'string', description: 'Email HTML body' },

      // SMS direct content
      text_content: { type: 'string', description: 'SMS text message' },

      // PUSH direct content
      push_title: { type: 'string', description: 'Push notification title' },
      push_body: { type: 'string', description: 'Push notification body' },
      push_image_url: { type: 'string', description: 'Push image URL' },
      push_action_url: { type: 'string', description: 'Push action URL' },
      push_data: { type: 'object', description: 'Push custom data payload' },

      // IN_APP direct content
      inapp_title: { type: 'string', description: 'In-app title' },
      inapp_body: { type: 'string', description: 'In-app body' },
      inapp_image_url: { type: 'string', description: 'In-app image URL' },
      inapp_action_url: { type: 'string', description: 'In-app action URL' },
      inapp_action_text: { type: 'string', description: 'In-app CTA button text' },

      // Recipient targeting
      recipientType: { type: 'string', enum: ['all', 'tags', 'segment', 'custom'] },
      recipientCount: { type: 'integer' },
      recipientTags: { type: 'array', items: { type: 'string' } },
      recipientSegment: { type: 'string' },

      // Campaign settings
      status: { type: 'string', enum: ['draft', 'scheduled', 'completed', 'cancelled'] },
      scheduledAt: { type: 'string', format: 'date-time' },
      metadata: { type: 'object' },
    },
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
      channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] },
      dateFrom: { type: 'string', format: 'date-time', description: 'Filter start date (default: 30 days ago)' },
      dateTo: { type: 'string', format: 'date-time', description: 'Filter end date (default: today)' },
    },
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

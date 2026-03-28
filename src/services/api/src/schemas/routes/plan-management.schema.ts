/**
 * Plan Management Admin API Schemas
 */

export const GetAllPlansSchema = {
  description: 'Get all plans with their limits',
  tags: ['Admin - Plans'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              price_monthly: { type: 'number' },
              price_yearly: { type: 'number' },
              limits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    metric: { type: 'string' },
                    limit_value: { type: 'integer' },
                    period: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const GetPlanSchema = {
  description: 'Get specific plan with limits',
  tags: ['Admin - Plans'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string', description: 'Plan ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price_monthly: { type: 'number' },
            limits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  metric: { type: 'string' },
                  limit_value: { type: 'integer' },
                  period: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const UpdateLimitSchema = {
  description: 'Update a plan limit',
  tags: ['Admin - Limits'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId', 'limitId'],
    properties: {
      planId: { type: 'string' },
      limitId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['limit_value'],
    properties: {
      limit_value: {
        type: 'integer',
        description: 'New limit value (-1 for unlimited)',
      },
      reason: {
        type: 'string',
        description: 'Reason for the change',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            plan_id: { type: 'string' },
            metric: { type: 'string' },
            limit_value: { type: 'integer' },
            previous_value: { type: 'integer' },
            updated_at: { type: 'string' },
          },
        },
      },
    },
  },
};

export const BatchUpdateLimitsSchema = {
  description: 'Batch update multiple limits for a plan',
  tags: ['Admin - Limits'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['updates'],
    properties: {
      updates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['metric', 'limit_value'],
          properties: {
            metric: { type: 'string' },
            limit_value: { type: 'integer' },
          },
        },
      },
      reason: {
        type: 'string',
        description: 'Reason for the batch update',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            plan_id: { type: 'string' },
            updated_count: { type: 'integer' },
            limits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  metric: { type: 'string' },
                  old_value: { type: 'integer' },
                  new_value: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const CreateLimitSchema = {
  description: 'Create a new limit for a plan',
  tags: ['Admin - Limits'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['metric', 'limit_value'],
    properties: {
      metric: {
        type: 'string',
        description: 'Metric name (e.g., emails_per_month)',
      },
      limit_value: {
        type: 'integer',
        description: 'Limit value (-1 for unlimited)',
      },
      period: {
        type: 'string',
        description: 'Period (monthly, yearly, daily)',
        default: 'monthly',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            plan_id: { type: 'string' },
            metric: { type: 'string' },
            limit_value: { type: 'integer' },
            period: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
      },
    },
  },
};

export const DeleteLimitSchema = {
  description: 'Delete a limit',
  tags: ['Admin - Limits'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId', 'limitId'],
    properties: {
      planId: { type: 'string' },
      limitId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const GetLimitHistorySchema = {
  description: 'Get limit change history for a plan',
  tags: ['Admin - Audit'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['planId'],
    properties: {
      planId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              limit_id: { type: 'string' },
              metric: { type: 'string' },
              old_value: { type: 'integer' },
              new_value: { type: 'integer' },
              reason: { type: 'string' },
              changed_by: { type: 'string' },
              changed_at: { type: 'string' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const SetLimitOverrideSchema = {
  description: 'Set temporary limit override for an account',
  tags: ['Admin - Overrides'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['accountId'],
    properties: {
      accountId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['metric', 'temporary_limit'],
    properties: {
      metric: {
        type: 'string',
        description: 'Metric to override',
      },
      temporary_limit: {
        type: 'integer',
        description: 'Temporary limit value',
      },
      expires_at: {
        type: 'string',
        description: 'ISO date when override expires',
      },
      reason: {
        type: 'string',
        description: 'Reason for the override',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            account_id: { type: 'string' },
            metric: { type: 'string' },
            plan_limit: { type: 'integer' },
            temporary_limit: { type: 'integer' },
            expires_at: { type: 'string' },
            created_at: { type: 'string' },
          },
        },
      },
    },
  },
};

export const GetAccountOverridesSchema = {
  description: 'Get all limit overrides for an account',
  tags: ['Admin - Overrides'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['accountId'],
    properties: {
      accountId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              metric: { type: 'string' },
              plan_limit: { type: 'integer' },
              temporary_limit: { type: 'integer' },
              expires_at: { type: 'string' },
              is_active: { type: 'boolean' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const RemoveOverrideSchema = {
  description: 'Remove a specific override for an account',
  tags: ['Admin - Overrides'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['accountId', 'metric'],
    properties: {
      accountId: { type: 'string' },
      metric: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
      },
    },
  },
};

export const GetDashboardStatsSchema = {
  description: 'Get admin dashboard statistics',
  tags: ['Admin - Dashboard'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'number' },
        data: {
          type: 'object',
          properties: {
            total_plans: { type: 'integer' },
            limits_changed_today: { type: 'integer' },
            active_overrides: { type: 'integer' },
            changes_this_week: { type: 'integer' },
            plans: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  changes_this_week: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
};

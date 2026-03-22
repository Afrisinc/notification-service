import { standardErrorResponses } from '../common/error-responses';

export const GetOrganizationByIdSchema = {
  description: 'Get organization details by ID',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid', description: 'Organization ID' },
    },
    required: ['orgId'],
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
            name: { type: 'string' },
            slug: { type: 'string' },
            legalName: { type: 'string' },
            location: { type: 'string' },
            country: { type: 'string' },
            taxId: { type: 'string' },
            orgEmail: { type: 'string', format: 'email' },
            orgPhone: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            memberCount: { type: 'integer' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
};

export const CreateOrganizationInviteSchema = {
  description: 'Create an invite to join an organization',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid' },
    },
    required: ['orgId'],
  },
  body: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email of the member to invite',
      },
      role: {
        type: 'string',
        enum: ['OWNER', 'ADMIN', 'MEMBER'],
        description: 'Role for the invited member',
      },
    },
    required: ['email', 'role'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: {
          type: 'object',
          properties: {
            inviteId: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const GetOrganizationMembersSchema = {
  description: 'Get all members of an organization',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid' },
    },
    required: ['orgId'],
  },
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
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
            orgId: { type: 'string', format: 'uuid' },
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
                  joinedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const RemoveOrganizationMemberSchema = {
  description: 'Remove a member from an organization (Admin/Owner only)',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid' },
      memberId: { type: 'string', format: 'uuid' },
    },
    required: ['orgId', 'memberId'],
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
            removed: { type: 'boolean' },
            memberId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const UpdateOrganizationSchema = {
  description: 'Update organization details (Owner only)',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid' },
    },
    required: ['orgId'],
  },
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Organization name',
      },
      legal_name: {
        type: 'string',
        description: 'Legal organization name',
      },
      country: {
        type: 'string',
        description: 'Country code or name',
      },
      org_email: {
        type: 'string',
        format: 'email',
        description: 'Organization email',
      },
      org_phone: {
        type: 'string',
        description: 'Organization phone number',
      },
      location: {
        type: 'string',
        description: 'Physical location/address',
      },
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
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            legal_name: { type: 'string' },
            country: { type: 'string' },
            org_email: { type: 'string' },
            org_phone: { type: 'string' },
            location: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const DeleteOrganizationSchema = {
  description: 'Delete an organization (Owner only)',
  tags: ['Organizations'],
  params: {
    type: 'object',
    properties: {
      orgId: { type: 'string', format: 'uuid' },
    },
    required: ['orgId'],
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
            deleted: { type: 'boolean' },
            orgId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const ValidateInviteSchema = {
  description: 'Validate an organization invitation (no auth required)',
  tags: ['Organizations', 'Invites'],
  params: {
    type: 'object',
    properties: {
      inviteId: { type: 'string', format: 'uuid', description: 'Invitation ID' },
      token: { type: 'string', description: 'Invitation token' },
    },
    required: ['inviteId', 'token'],
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
            inviteId: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            orgId: { type: 'string', format: 'uuid' },
            orgName: { type: 'string' },
            role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'expired'] },
            expiresAt: { type: 'string', format: 'date-time' },
            isExpired: { type: 'boolean' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
};

export const AcceptInviteSchema = {
  description: 'Accept an organization invitation and add user to organization',
  tags: ['Organizations', 'Invites'],
  params: {
    type: 'object',
    properties: {
      inviteId: { type: 'string', format: 'uuid', description: 'Invitation ID' },
      token: { type: 'string', description: 'Invitation token' },
    },
    required: ['inviteId', 'token'],
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
            memberId: { type: 'string', format: 'uuid' },
            orgId: { type: 'string', format: 'uuid' },
            orgName: { type: 'string' },
            role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
            addedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

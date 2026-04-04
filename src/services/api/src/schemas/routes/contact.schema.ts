import { standardErrorResponses } from '../common/error-responses';

const contactObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'] },
    subscribed: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    attributes: { type: 'object' },
    notificationCount: { type: 'integer' },
    lastNotificationSent: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const ListContactsSchema = {
  description: 'List all contacts for an app with pagination and filtering',
  tags: ['Contacts'],
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
      search: { type: 'string', description: 'Search by email, first name, or last name' },
      status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'], description: 'Filter by status' },
      tags: { type: 'string', description: 'Comma-separated tags to filter by' },
      subscribed: { type: 'boolean', description: 'Filter by subscription status' },
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
            contacts: { type: 'array', items: contactObject },
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

export const CreateContactSchema = {
  description: 'Create a new contact (supports both authenticated and public access with contact form support)',
  tags: ['Contacts'],
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
      email: { type: 'string', format: 'email', description: 'Email address (required)' },
      firstName: { type: 'string', description: 'First name' },
      lastName: { type: 'string', description: 'Last name' },
      phone: { type: 'string', description: 'Phone number' },
      company: { type: 'string', description: 'Company name' },
      subject: { type: 'string', description: 'Subject or inquiry topic' },
      message: { type: 'string', description: 'Contact form message (for contact_form source)' },
      status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'], default: 'active' },
      subscribed: { type: 'boolean', default: true },
      tags: { type: 'array', items: { type: 'string' } },
      attributes: { type: 'object', description: 'Custom attributes' },
      source: {
        type: 'string',
        enum: ['contact_form', 'import', 'api', 'webhook', 'widget', 'newsletter'],
        description:
          'Contact source. When set to contact_form: automatically adds contact_form tag and sends auto-reply email',
      },
    },
    required: ['email'],
  },
  headers: {
    type: 'object',
    properties: {
      'x-account-id': { type: 'string', description: 'Account ID (optional - auto-resolved from app if not provided)' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        resp_msg: { type: 'string' },
        resp_code: { type: 'integer' },
        data: contactObject,
      },
    },
    ...standardErrorResponses,
  },
};

export const GetContactSchema = {
  description: 'Get a single contact by ID',
  tags: ['Contacts'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      contactId: { type: 'string', format: 'uuid', description: 'Contact ID' },
    },
    required: ['appId', 'contactId'],
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
        data: contactObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const UpdateContactSchema = {
  description: 'Update a contact',
  tags: ['Contacts'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      contactId: { type: 'string', format: 'uuid', description: 'Contact ID' },
    },
    required: ['appId', 'contactId'],
  },
  body: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phone: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'] },
      subscribed: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      attributes: { type: 'object' },
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
        data: contactObject,
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const DeleteContactSchema = {
  description: 'Delete a contact',
  tags: ['Contacts'],
  params: {
    type: 'object',
    properties: {
      appId: { type: 'string', format: 'uuid', description: 'Application ID' },
      contactId: { type: 'string', format: 'uuid', description: 'Contact ID' },
    },
    required: ['appId', 'contactId'],
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

export const BulkImportContactsSchema = {
  description: 'Bulk import contacts',
  tags: ['Contacts'],
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
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'] },
            subscribed: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
            attributes: { type: 'object' },
          },
          required: ['email'],
        },
      },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to add to all imported contacts' },
      updateIfExists: { type: 'boolean', default: false, description: 'Update existing contacts' },
    },
    required: ['contacts'],
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
        data: {
          type: 'object',
          properties: {
            imported: { type: 'integer' },
            updated: { type: 'integer' },
            skipped: { type: 'integer' },
            failed: { type: 'integer' },
            errors: { type: 'array' },
            createdIds: { type: 'array', items: { type: 'string' } },
            importedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const SearchContactsSchema = {
  description: 'Search contacts',
  tags: ['Contacts'],
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
      q: { type: 'string', description: 'Search query (required)' },
      fields: { type: 'string', description: 'Comma-separated fields to search (default: email,firstName,lastName)' },
      limit: { type: 'integer', default: 20, maximum: 100 },
    },
    required: ['q'],
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
            results: { type: 'array', items: contactObject },
            total: { type: 'integer' },
            query: { type: 'string' },
          },
        },
      },
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

export const ExportContactsSchema = {
  description: 'Export contacts as CSV or JSON',
  tags: ['Contacts'],
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
      format: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
      status: { type: 'string', enum: ['active', 'inactive', 'unsubscribed'] },
      tags: { type: 'string', description: 'Comma-separated tags to filter' },
      fields: { type: 'string', description: 'Comma-separated fields to include' },
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
      type: 'string',
      description: 'File download (CSV or JSON)',
    },
    ...standardErrorResponses,
  },
  security: [{ bearerAuth: [] }],
};

import { FastifyRequest, FastifyReply } from 'fastify';
import { contactService } from '../services/contact.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils';
import pino from 'pino';

const logger = pino();

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export async function listContacts(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      tags?: string;
      subscribed?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const subscribed = query.subscribed ? query.subscribed === 'true' : undefined;

    const result = await contactService.listContacts(appId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      search: query.search,
      status: query.status,
      tags: query.tags,
      subscribed,
    });

    return ApiResponseHelper.success(reply, 'Contacts retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage, appId: (req.params as any).appId }, 'Failed to list contacts');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function createContact(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const body = req.body as {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      status?: string;
      subscribed?: boolean;
      tags?: string[];
      attributes?: Record<string, any>;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!body.email) {
      return ApiResponseHelper.badRequest(reply, 'Email is required');
    }

    const contact = await contactService.createContact(appId, {
      app_id: appId,
      email: body.email,
      first_name: body.firstName,
      last_name: body.lastName,
      phone: body.phone,
      status: body.status as any,
      subscribed: body.subscribed,
      tags: body.tags,
      attributes: body.attributes,
    });

    // Track usage
    await UsageTrackingService.recordUsage(accountId, appId, 'contacts', 1);

    return ApiResponseHelper.success(reply, 'Contact created successfully', contact, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('already exists')) {
      return ApiResponseHelper.conflict(reply, errorMessage);
    }
    if (errorMessage.includes('Invalid')) {
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
    logger.error({ error: errorMessage, appId: (req.params as any).appId }, 'Failed to create contact');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getContact(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, contactId } = req.params as { appId: string; contactId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const contact = await contactService.getContact(appId, contactId);

    return ApiResponseHelper.success(reply, 'Contact retrieved successfully', contact);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get contact');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function updateContact(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, contactId } = req.params as { appId: string; contactId: string };
    const body = req.body as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      status?: string;
      subscribed?: boolean;
      tags?: string[];
      attributes?: Record<string, any>;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const contact = await contactService.updateContact(appId, contactId, {
      first_name: body.firstName,
      last_name: body.lastName,
      phone: body.phone,
      status: body.status as any,
      subscribed: body.subscribed,
      tags: body.tags,
      attributes: body.attributes,
    });

    return ApiResponseHelper.success(reply, 'Contact updated successfully', contact);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to update contact');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function deleteContact(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId, contactId } = req.params as { appId: string; contactId: string };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const result = await contactService.deleteContact(appId, contactId);

    return ApiResponseHelper.success(reply, 'Contact deleted successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to delete contact');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function bulkImportContacts(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const body = req.body as {
      contacts: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        status?: string;
        subscribed?: boolean;
        tags?: string[];
        attributes?: Record<string, any>;
      }>;
      tags?: string[];
      updateIfExists?: boolean;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!body.contacts || !Array.isArray(body.contacts)) {
      return ApiResponseHelper.badRequest(reply, 'Contacts array is required');
    }

    const result = await contactService.bulkImportContacts(
      appId,
      body.contacts.map((c) => ({
        app_id: appId,
        email: c.email,
        first_name: c.firstName,
        last_name: c.lastName,
        phone: c.phone,
        status: c.status as any,
        subscribed: c.subscribed,
        tags: c.tags,
        attributes: c.attributes,
      })),
      {
        tags: body.tags,
        updateIfExists: body.updateIfExists,
      }
    );

    // Track usage for successfully imported contacts
    await UsageTrackingService.recordUsage(accountId, appId, 'contacts', result.imported);

    return ApiResponseHelper.success(reply, 'Contacts imported successfully', result, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('validation')) {
      return ApiResponseHelper.badRequest(reply, 'Import validation failed');
    }
    logger.error({ error: errorMessage }, 'Failed to bulk import contacts');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function searchContacts(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      q?: string;
      fields?: string;
      limit?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    if (!query.q) {
      return ApiResponseHelper.badRequest(reply, 'Search query (q) is required');
    }

    const result = await contactService.searchContacts(appId, query.q, {
      fields: query.fields,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });

    return ApiResponseHelper.success(reply, 'Search completed successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to search contacts');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function exportContacts(req: FastifyRequest, reply: FastifyReply) {
  try {
    const accountId = req.headers['x-account-id'] as string;
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      format?: string;
      status?: string;
      tags?: string;
      fields?: string;
    };

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    const format = query.format || 'csv';
    const contacts = await contactService.getContactsForExport(appId, {
      status: query.status,
      tags: query.tags,
    });

    if (format === 'json') {
      const filename = `contacts-${new Date().toISOString().split('T')[0]}.json`;
      return reply.header('Content-Disposition', `attachment; filename=${filename}`).send(contacts);
    }

    // CSV export
    if (contacts.length === 0) {
      const filename = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename=${filename}`)
        .send('email,firstName,lastName,phone,status,subscribed,tags,createdAt,updatedAt\n');
    }

    const csvContent = convertToCsv(contacts, query.fields?.split(','));
    const filename = `contacts-${new Date().toISOString().split('T')[0]}.csv`;

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename=${filename}`)
      .send(csvContent);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to export contacts');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

function convertToCsv(contacts: any[], fields?: string[]): string {
  const defaultFields = ['email', 'firstName', 'lastName', 'phone', 'status', 'subscribed', 'tags', 'createdAt'];
  const fieldsToUse = fields || defaultFields;

  const headers = fieldsToUse.join(',');
  const rows = contacts.map((contact: any) => {
    return fieldsToUse
      .map((field) => {
        let value = contact[field];
        if (Array.isArray(value)) {
          value = `"${value.join(';')}"`;
        } else if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          value = `"${value}"`;
        }
        return value ?? '';
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}

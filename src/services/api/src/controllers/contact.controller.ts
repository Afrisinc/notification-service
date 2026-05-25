import { FastifyRequest, FastifyReply } from 'fastify';
import { contactService } from '../services/contact.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { NotifyService } from '../services/notify.service';
import { PaygService } from '../services/payg.service';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils';
import { prismaRead } from '@shared/database';
import { AccountService } from '../services/account.service';
import { CreateContactDto, UpdateContactDto, ListContactsQuery } from '../types/contact.types';
import pino from 'pino';

const logger = pino();
const notifyService = new NotifyService();
const accountService = new AccountService();

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export async function listContacts(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const query = req.query as ListContactsQuery;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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
    const { appId } = req.params as { appId: string };
    const body = req.body as CreateContactDto;

    if (!body.email) {
      return ApiResponseHelper.badRequest(reply, 'Email is required');
    }

    const accountId = await accountService.getAccountIdByAppId(appId);

    // Check contact limit before creation
    const limitCheck = await PlanEnforcementMiddleware.checkEntityLimit(accountId, 'contacts');
    if (!limitCheck.allowed) {
      return ApiResponseHelper.error(
        reply,
        `Cannot create more contacts. Plan limit reached: ${limitCheck.limit}. Please upgrade your plan.`,
        4020,
        403
      );
    }

    // Add contact_form tag if source is contact_form
    const tags = body.tags || [];
    if (body.source === 'contact_form' && !tags.includes('contact_form')) {
      tags.push('contact_form');
    }

    // Prepare attributes with optional fields if provided
    const attributes = body.attributes || {};
    if (body.message) {
      attributes.message = body.message;
    }
    if (body.company) {
      attributes.company = body.company;
    }
    if (body.subject) {
      attributes.subject = body.subject;
    }

    const contact = await contactService.createContact(appId, {
      app_id: appId,
      email: body.email,
      first_name: body.firstName,
      last_name: body.lastName,
      phone: body.phone,
      status: body.status as any,
      subscribed: body.subscribed,
      tags,
      attributes,
      source: body.source as 'contact_form' | 'api' | 'import' | 'webhook' | 'widget' | undefined,
    });

    // Track usage
    await UsageTrackingService.recordUsage(accountId, appId, 'contacts', 1);

    // Send auto-reply for contact form submissions
    if (body.source === 'contact_form') {
      try {
        // Look up or create auto-reply template
        const template = await prismaRead.template.findFirst({
          where: {
            account_id: accountId,
            code: 'CONTACT_FORM_AUTOREPLY',
          },
          select: { id: true },
        });

        if (template) {
          // Check PAYG balance before sending
          const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);
          if (isPayg) {
            const balanceCheck = await PaygService.checkSufficientBalance(accountId, 'EMAIL', 1);
            if (!balanceCheck.sufficient) {
              logger.warn(
                { accountId, contactId: contact.id, balance: balanceCheck.available },
                'Skipping contact form auto-reply: insufficient PAYG balance'
              );
            } else {
              // Send auto-reply and deduct credits
              notifyService
                .sendNotification(accountId, appId, {
                  channel: 'EMAIL',
                  recipient: body.email,
                  templateId: template.id,
                  app_id: appId,
                  payload: {
                    firstName: body.firstName || 'Valued Customer',
                    companyName: 'Our Team',
                  },
                })
                .then(async (notification) => {
                  await PaygService.deductCredits({
                    accountId,
                    channel: 'EMAIL',
                    quantity: 1,
                    notificationId: notification.id,
                  });
                  logger.info({ accountId, notificationId: notification.id }, 'PAYG auto-reply sent and credited');
                })
                .catch((err) => {
                  logger.error({ error: err, contactId: contact.id }, 'Failed to send contact form auto-reply');
                });
            }
          } else {
            // Non-PAYG: send auto-reply and record usage
            notifyService
              .sendNotification(accountId, appId, {
                channel: 'EMAIL',
                recipient: body.email,
                templateId: template.id,
                app_id: appId,
                payload: {
                  firstName: body.firstName || 'Valued Customer',
                  companyName: 'Our Team',
                },
              })
              .then(async () => {
                await UsageTrackingService.recordUsage(accountId, appId, 'emails_per_month', 1);
              })
              .catch((err) => {
                logger.error({ error: err, contactId: contact.id }, 'Failed to send contact form auto-reply');
              });
          }
        } else {
          logger.info({ contactId: contact.id }, 'Contact form template not found, skipping auto-reply');
        }
      } catch (err) {
        logger.error({ error: err, contactId: contact.id }, 'Error sending contact form auto-reply');
        // Don't fail the contact creation if auto-reply fails
      }
    }

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
    const { appId, contactId } = req.params as { appId: string; contactId: string };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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
    const { appId, contactId } = req.params as { appId: string; contactId: string };
    const body = req.body as UpdateContactDto;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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
    const { appId, contactId } = req.params as { appId: string; contactId: string };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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
    const accountId = await accountService.getAccountIdByAppId(appId);

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
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      q?: string;
      fields?: string;
      limit?: string;
    };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      format?: string;
      status?: string;
      tags?: string;
      fields?: string;
    };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

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

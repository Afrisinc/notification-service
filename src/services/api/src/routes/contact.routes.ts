import type { FastifyInstance } from 'fastify';
import {
  listContacts,
  createContact,
  getContact,
  updateContact,
  deleteContact,
  bulkImportContacts,
  searchContacts,
  exportContacts,
} from '../controllers/contact.controller';
import { flexAuthMiddleware, validateBaseToken } from '../middlewares/auth.middleware';
import { planGuards } from '../guards/plan-guard';
import {
  ListContactsSchema,
  CreateContactSchema,
  CreateContactSdkSchema,
  GetContactSchema,
  UpdateContactSchema,
  DeleteContactSchema,
  BulkImportContactsSchema,
  SearchContactsSchema,
  ExportContactsSchema,
} from '../schemas/routes/contact.schema';

export async function registerContactRoutes(app: FastifyInstance) {
  // List Contacts
  app.get(
    '/apps/:appId/contacts',
    {
      onRequest: [validateBaseToken],
      schema: ListContactsSchema,
    },
    listContacts
  );

  // Search Contacts (before specific ID routes for route specificity)
  app.get(
    '/apps/:appId/contacts/search',
    {
      onRequest: [validateBaseToken],
      schema: SearchContactsSchema,
    },
    searchContacts
  );

  // Export Contacts
  app.get(
    '/apps/:appId/contacts/export',
    {
      onRequest: [validateBaseToken],
      schema: ExportContactsSchema,
    },
    exportContacts
  );

  // Create Contact - SDK route (no :appId in URL; resolved via flexAuthMiddleware,
  // see resolveAppContext in contact.controller.ts)
  app.post(
    '/contacts',
    {
      preHandler: [flexAuthMiddleware, planGuards.checkEntityLimit('contacts')],
      schema: CreateContactSdkSchema,
    },
    createContact
  );

  // Create Contact
  app.post(
    '/apps/:appId/contacts',
    {
      schema: CreateContactSchema,
    },
    createContact
  );

  // Bulk Import Contacts
  app.post(
    '/apps/:appId/contacts/import',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('contacts')],
      schema: BulkImportContactsSchema,
    },
    bulkImportContacts
  );

  // Get Single Contact
  app.get(
    '/apps/:appId/contacts/:contactId',
    {
      onRequest: [validateBaseToken],
      schema: GetContactSchema,
    },
    getContact
  );

  // Update Contact
  app.put(
    '/apps/:appId/contacts/:contactId',
    {
      onRequest: [validateBaseToken],
      schema: UpdateContactSchema,
    },
    updateContact
  );

  // Delete Contact
  app.delete(
    '/apps/:appId/contacts/:contactId',
    {
      onRequest: [validateBaseToken],
      schema: DeleteContactSchema,
    },
    deleteContact
  );
}

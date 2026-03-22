import pino from 'pino';
import {
  contactRepository,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
} from '../repositories/contact.repository';

const logger = pino();

export class ContactService {
  /**
   * Create a new contact
   */
  async createContact(appId: string, data: CreateContactInput) {
    try {
      // Validate email uniqueness
      const existing = await contactRepository.findByEmail(data.email, appId);
      if (existing) {
        throw new Error('Contact with this email already exists');
      }

      // Validate email format
      if (!this.isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      const contact = await contactRepository.create({
        ...data,
        app_id: appId,
      });

      return this.formatContactResponse(contact);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to create contact');
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(appId: string, contactId: string) {
    try {
      const contact = await contactRepository.findById(contactId, appId);

      if (!contact) {
        throw new Error('Contact not found');
      }

      return this.formatContactResponse(contact);
    } catch (error) {
      logger.error({ error, appId, contactId }, 'Failed to get contact');
      throw error;
    }
  }

  /**
   * List contacts with pagination and filtering
   */
  async listContacts(
    appId: string,
    options: { page?: number; limit?: number; search?: string; status?: string; tags?: string; subscribed?: boolean }
  ) {
    try {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));

      const tags = options.tags ? options.tags.split(',').map((t) => t.trim()) : undefined;

      const { contacts, total } = await contactRepository.list(appId, {
        page,
        limit,
        search: options.search,
        status: options.status as any,
        tags,
        subscribed: options.subscribed,
      });

      const formatted = contacts.map((c: any) => this.formatContactResponse(c));

      return {
        appId,
        contacts: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to list contacts');
      throw error;
    }
  }

  /**
   * Search contacts
   */
  async searchContacts(appId: string, query: string, options: { fields?: string; limit?: number } = {}) {
    try {
      const fields = options.fields
        ? options.fields.split(',').map((f) => f.trim())
        : ['email', 'first_name', 'last_name'];
      const limit = Math.min(100, options.limit || 20);

      const results = await contactRepository.search(appId, query, fields, limit);

      const formatted = results.map((c: any) => this.formatContactResponse(c));

      return {
        results: formatted,
        total: formatted.length,
        query,
      };
    } catch (error) {
      logger.error({ error, appId, query }, 'Failed to search contacts');
      throw error;
    }
  }

  /**
   * Update contact
   */
  async updateContact(appId: string, contactId: string, data: UpdateContactInput) {
    try {
      const contact = await contactRepository.findById(contactId, appId);

      if (!contact) {
        throw new Error('Contact not found');
      }

      const updated = await contactRepository.update(contactId, appId, data);

      return this.formatContactResponse(updated);
    } catch (error) {
      logger.error({ error, appId, contactId }, 'Failed to update contact');
      throw error;
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(appId: string, contactId: string) {
    try {
      const contact = await contactRepository.findById(contactId, appId);

      if (!contact) {
        throw new Error('Contact not found');
      }

      await contactRepository.delete(contactId, appId);

      return {
        id: contactId,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, appId, contactId }, 'Failed to delete contact');
      throw error;
    }
  }

  /**
   * Bulk import contacts
   */
  async bulkImportContacts(
    appId: string,
    contacts: CreateContactInput[],
    options: { tags?: string[]; updateIfExists?: boolean } = {}
  ) {
    try {
      if (contacts.length === 0) {
        throw new Error('Contacts array cannot be empty');
      }

      if (contacts.length > 1000) {
        throw new Error('Maximum 1000 contacts per import');
      }

      // Validate email format for all contacts
      const invalidEmails = contacts.filter((c) => !this.isValidEmail(c.email));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email format in ${invalidEmails.length} contact(s)`);
      }

      // Add bulk import tags to all contacts
      const contactsWithTags = contacts.map((c) => ({
        ...c,
        tags: [...(c.tags || []), ...(options.tags || [])],
      }));

      const result = await contactRepository.bulkImport(appId, contactsWithTags, options.updateIfExists || false);

      return {
        imported: result.imported,
        updated: result.updated,
        skipped: result.failed,
        failed: result.failed,
        errors: result.errors,
        createdIds: result.createdIds,
        importedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to bulk import contacts');
      throw error;
    }
  }

  /**
   * Get contacts for export
   */
  async getContactsForExport(appId: string, filters: { status?: string; tags?: string }) {
    try {
      const tags = filters.tags ? filters.tags.split(',').map((t) => t.trim()) : undefined;

      const { contacts } = await contactRepository.list(appId, {
        page: 1,
        limit: 100000,
        status: filters.status as any,
        tags,
      });

      return contacts.map((c) => this.formatContactResponse(c));
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get contacts for export');
      throw error;
    }
  }

  /**
   * Format contact response
   */
  private formatContactResponse(contact: any) {
    return {
      id: contact.id,
      email: contact.email,
      firstName: contact.first_name,
      lastName: contact.last_name,
      phone: contact.phone,
      status: contact.status,
      subscribed: contact.subscribed,
      tags: contact.tags || [],
      attributes: contact.attributes || {},
      notificationCount: contact.notification_count,
      lastNotificationSent: contact.last_notification_sent ? contact.last_notification_sent.toISOString() : null,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Increment notification count for contact
   */
  async recordNotification(contactId: string) {
    try {
      await contactRepository.incrementNotificationCount(contactId);
    } catch (error) {
      logger.warn({ error, contactId }, 'Failed to record notification');
    }
  }
}

export const contactService = new ContactService();

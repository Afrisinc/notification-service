import { prismaRead, prismaWrite } from '@shared/database';

export interface CreateContactInput {
  app_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'unsubscribed';
  subscribed?: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
}

export interface UpdateContactInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'unsubscribed';
  subscribed?: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
}

export interface ContactFilters {
  status?: 'active' | 'inactive' | 'unsubscribed';
  subscribed?: boolean;
  tags?: string[];
  search?: string;
}

export class ContactRepository {
  /**
   * Create a new contact
   */
  async create(data: CreateContactInput) {
    return prismaWrite.contact.create({
      data: {
        app_id: data.app_id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        status: data.status || 'active',
        subscribed: data.subscribed !== false,
        tags: data.tags || [],
        attributes: data.attributes || {},
      },
    });
  }

  /**
   * Find contact by ID
   */
  async findById(id: string, appId: string) {
    return prismaRead.contact.findFirst({
      where: { id, app_id: appId },
    });
  }

  /**
   * Find contact by email
   */
  async findByEmail(email: string, appId: string) {
    return prismaRead.contact.findFirst({
      where: { email, app_id: appId },
    });
  }

  /**
   * List contacts with pagination and filtering
   */
  async list(appId: string, filters: ContactFilters & { page: number; limit: number }) {
    const skip = (filters.page - 1) * filters.limit;

    const where: any = { app_id: appId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (typeof filters.subscribed === 'boolean') {
      where.subscribed = filters.subscribed;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      where.OR = [
        { email: { contains: searchLower, mode: 'insensitive' } },
        { first_name: { contains: searchLower, mode: 'insensitive' } },
        { last_name: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prismaRead.contact.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prismaRead.contact.count({ where }),
    ]);

    return { contacts, total };
  }

  /**
   * Search contacts
   */
  async search(
    appId: string,
    query: string,
    fields: string[] = ['email', 'first_name', 'last_name'],
    limit: number = 20
  ) {
    const searchLower = query.toLowerCase();
    const orConditions: any[] = [];

    if (fields.includes('email')) {
      orConditions.push({ email: { contains: searchLower, mode: 'insensitive' } });
    }
    if (fields.includes('firstName') || fields.includes('first_name')) {
      orConditions.push({ first_name: { contains: searchLower, mode: 'insensitive' } });
    }
    if (fields.includes('lastName') || fields.includes('last_name')) {
      orConditions.push({ last_name: { contains: searchLower, mode: 'insensitive' } });
    }

    const where: any = {
      app_id: appId,
      ...(orConditions.length > 0 && { OR: orConditions }),
    };

    const contacts = await prismaRead.contact.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return contacts;
  }

  /**
   * Update contact
   */
  async update(id: string, appId: string, data: UpdateContactInput) {
    return prismaWrite.contact.update({
      where: { id },
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        status: data.status,
        subscribed: data.subscribed,
        tags: data.tags,
        attributes: data.attributes,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete contact
   */
  async delete(id: string, appId: string) {
    return prismaWrite.contact.delete({
      where: { id },
    });
  }

  /**
   * Bulk import contacts
   */
  async bulkImport(appId: string, contacts: CreateContactInput[], updateIfExists: boolean = false) {
    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      createdIds: [] as string[],
      errors: [] as Array<{ email: string; reason: string }>,
    };

    for (const contactData of contacts) {
      try {
        const existing = await this.findByEmail(contactData.email, appId);

        if (existing) {
          if (updateIfExists) {
            const updated = await this.update(existing.id, appId, contactData);
            results.updated++;
          } else {
            results.failed++;
            results.errors.push({
              email: contactData.email,
              reason: 'Contact already exists',
            });
          }
        } else {
          const created = await this.create(contactData);
          results.imported++;
          results.createdIds.push(created.id);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: contactData.email,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get contacts by tags
   */
  async findByTags(appId: string, tags: string[]) {
    return prismaRead.contact.findMany({
      where: {
        app_id: appId,
        tags: { hasSome: tags },
      },
    });
  }

  /**
   * Increment notification count
   */
  async incrementNotificationCount(id: string) {
    return prismaWrite.contact.update({
      where: { id },
      data: {
        notification_count: { increment: 1 },
        last_notification_sent: new Date(),
      },
    });
  }

  /**
   * Get contact count by status
   */
  async countByStatus(appId: string) {
    const statuses = await prismaRead.contact.groupBy({
      by: ['status'],
      where: { app_id: appId },
      _count: true,
    });

    return statuses.reduce(
      (acc: Record<string, number>, s: any) => {
        acc[s.status] = s._count;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

export const contactRepository = new ContactRepository();

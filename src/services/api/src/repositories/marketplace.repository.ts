import { prismaRead, prismaWrite } from '@shared/database';

export interface MarketplaceFilters {
  search?: string;
  channel?: string;
  category?: string;
  price?: string; // 'free' or 'paid'
  sortBy?: string; // 'rating', 'installs', 'price'
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export class MarketplaceRepository {
  /**
   * List marketplace templates with filtering and search
   */
  async listTemplates(filters: MarketplaceFilters) {
    const skip = (filters.page - 1) * filters.limit;
    const where: any = {
      visibility: 'marketplace',
      is_public: true,
      deletedAt: null,
    };

    // Search by name or description
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filter by channel
    if (filters.channel) {
      where.channel = filters.channel.toUpperCase().replace(/-/g, '_');
    }

    // Filter by category
    if (filters.category) {
      where.category = filters.category.toUpperCase();
    }

    // Filter by price
    if (filters.price === 'free') {
      where.price = { in: [0, null] };
    } else if (filters.price === 'paid') {
      where.price = { gt: 0 };
    }

    // Sorting
    let orderBy: any = { rating: 'desc' };
    if (filters.sortBy === 'installs') {
      orderBy = { installs: filters.sortOrder || 'desc' };
    } else if (filters.sortBy === 'price') {
      orderBy = { price: filters.sortOrder || 'asc' };
    } else {
      orderBy = { rating: filters.sortOrder || 'desc' };
    }

    const [templates, total] = await Promise.all([
      prismaRead.template.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy,
        select: {
          id: true,
          code: true,
          subject: true,
          channel: true,
          category: true,
          description: true,
          thumbnail: true,
          previewUrl: true,
          rating: true,
          ratingCount: true,
          installs: true,
          price: true,
          currency: true,
          tags: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prismaRead.template.count({ where }),
    ]);

    return { templates, total };
  }

  /**
   * Get marketplace template details
   */
  async getTemplateDetails(templateId: string) {
    return prismaRead.template.findFirst({
      where: {
        id: templateId,
        visibility: 'marketplace',
        is_public: true,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            review: true,
            helpful: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Increment installation count
   */
  async incrementInstalls(templateId: string) {
    return prismaWrite.template.update({
      where: { id: templateId },
      data: { installs: { increment: 1 } },
    });
  }

  /**
   * Submit or update a review
   */
  async submitReview(
    templateId: string,
    userId: string,
    data: {
      rating: number;
      review?: string;
    }
  ) {
    return prismaWrite.templateReview.upsert({
      where: {
        template_id_user_id: {
          template_id: templateId,
          user_id: userId,
        },
      },
      update: {
        rating: data.rating,
        review: data.review,
        updatedAt: new Date(),
      },
      create: {
        id: Math.random().toString(36).substring(7),
        template_id: templateId,
        user_id: userId,
        rating: data.rating,
        review: data.review,
      },
    });
  }

  /**
   * Get user's rating for a template
   */
  async getUserRating(templateId: string, userId: string) {
    return prismaRead.templateReview.findFirst({
      where: {
        template_id: templateId,
        user_id: userId,
      },
    });
  }

  /**
   * Update template rating based on reviews
   */
  async updateTemplateRating(templateId: string) {
    const reviews = await prismaRead.templateReview.findMany({
      where: { template_id: templateId },
    });

    if (reviews.length === 0) {
      return prismaWrite.template.update({
        where: { id: templateId },
        data: {
          rating: 0,
          ratingCount: 0,
        },
      });
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    return prismaWrite.template.update({
      where: { id: templateId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        ratingCount: reviews.length,
      },
    });
  }

  /**
   * Get marketplace categories with counts
   */
  async getCategories() {
    const categories = await prismaRead.template.groupBy({
      by: ['category'],
      where: {
        visibility: 'marketplace',
        is_public: true,
        deletedAt: null,
      },
      _count: true,
    });

    const categoryNames: Record<string, string> = {
      AUTH: 'Authentication',
      TRANSACTIONAL: 'Transactional',
      MARKETING: 'Marketing',
      NOTIFICATION: 'Alerts',
    };

    const categoryIcons: Record<string, string> = {
      AUTH: 'lock',
      TRANSACTIONAL: 'receipt',
      MARKETING: 'megaphone',
      NOTIFICATION: 'bell',
    };

    const categoryDescriptions: Record<string, string> = {
      AUTH: 'Login, signup, password reset, 2FA templates',
      TRANSACTIONAL: 'Receipts, invoices, order confirmations',
      MARKETING: 'Promotions, newsletters, announcements',
      NOTIFICATION: 'System alerts, warnings, notifications',
    };

    return categories.map((cat) => ({
      id: cat.category.toLowerCase(),
      name: categoryNames[cat.category] || cat.category,
      description: categoryDescriptions[cat.category] || '',
      count: cat._count,
      icon: categoryIcons[cat.category] || 'document',
    }));
  }

  /**
   * Get marketplace filters metadata
   */
  async getFilters() {
    const channels = await prismaRead.template.findMany({
      where: {
        visibility: 'marketplace',
        is_public: true,
        deletedAt: null,
      },
      distinct: ['channel'],
      select: { channel: true },
    });

    const categories = await this.getCategories();

    return {
      channels: channels.map((c) => c.channel.toLowerCase()),
      categories: categories.map((c) => c.id),
      priceRanges: ['free', 'paid'],
    };
  }
}

export const marketplaceRepository = new MarketplaceRepository();

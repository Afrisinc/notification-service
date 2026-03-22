import { marketplaceRepository, MarketplaceFilters } from '../repositories/marketplace.repository';
import { appSettingsRepository } from '../repositories/app-settings.repository';
import { prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

export class MarketplaceService {
  /**
   * List marketplace templates with filtering
   */
  async listTemplates(filters: MarketplaceFilters) {
    try {
      const page = Math.max(1, filters.page || 1);
      const limit = Math.min(50, Math.max(1, filters.limit || 12));

      const { templates, total } = await marketplaceRepository.listTemplates({
        ...filters,
        page,
        limit,
      });

      const marketplaceFilters = await marketplaceRepository.getFilters();

      return {
        templates: templates.map((t: any) => ({
          id: t.id,
          name: t.code,
          subject: t.subject,
          description: t.description,
          channel: t.channel.toLowerCase(),
          category: t.category.toLowerCase(),
          creator: t.createdBy ? `${t.createdBy.firstName || ''} ${t.createdBy.lastName || ''}`.trim() : 'Notify Team',
          creatorAvatar: 'https://api.example.com/avatars/default.png',
          price: t.price || 0,
          currency: t.currency || 'USD',
          rating: t.rating || 0,
          ratingCount: t.ratingCount || 0,
          installs: t.installs || 0,
          thumbnail: t.thumbnail || '',
          previewUrl: '',
          variables: [],
          tags: t.tags || [],
        })),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        filters: marketplaceFilters,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to list marketplace templates');
      throw error;
    }
  }

  /**
   * Get template details
   */
  async getTemplateDetails(templateId: string) {
    try {
      const template = await marketplaceRepository.getTemplateDetails(templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      return {
        id: template.id,
        name: template.code,
        description: template.description,
        channel: template.channel.toLowerCase(),
        category: template.category.toLowerCase(),
        creator: {
          id: template.createdBy?.id,
          name: template.createdBy
            ? `${template.createdBy.firstName || ''} ${template.createdBy.lastName || ''}`.trim()
            : 'Notify Team',
          avatar: 'https://api.example.com/avatars/default.png',
          bio: 'Template creator',
        },
        price: template.price || 0,
        currency: template.currency || 'USD',
        rating: template.rating || 0,
        ratingCount: template.ratingCount || 0,
        installs: template.installs || 0,
        thumbnail: template.thumbnail || '',
        previewUrl: template.previewUrl || '',
        screenshots: template.screenshots || [],
        variables: [],
        tags: template.tags || [],
        content: template.content,
        designJson: template.design_json,
        editorType: template.editor_type,
        language: template.language,
        estimatedDeliveryTime: template.estimatedDeliveryTime || '< 1 second',
        compatibility: template.compatibility || {},
        reviews: template.reviews.map((r: any) => ({
          userId: r.user?.id,
          userName: r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() : 'Anonymous',
          rating: r.rating,
          review: r.review,
          createdAt: r.createdAt.toISOString(),
          helpful: r.helpful,
        })),
        relatedTemplates: template.relatedTemplates || [],
        changelog: template.changelog || [],
      };
    } catch (error) {
      logger.error({ error, templateId }, 'Failed to get template details');
      throw error;
    }
  }

  /**
   * Install template to app
   */
  async installTemplate(
    templateId: string,
    appId: string,
    userId: string,
    data: {
      templateName?: string;
      description?: string;
    }
  ) {
    try {
      const template = await marketplaceRepository.getTemplateDetails(templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Increment installs
      await marketplaceRepository.incrementInstalls(templateId);

      // Create app template installation record in database
      const appTemplate = await prismaWrite.appTemplate.create({
        data: {
          app_id: appId,
          template_id: templateId,
          customizations: data,
          installationDate: new Date(),
        },
      });

      return {
        id: appTemplate.id,
        appId: appTemplate.app_id,
        templateId: appTemplate.template_id,
        name: data.templateName || template.code,
        description: data.description || template.description,
        channel: template.channel.toLowerCase(),
        content: template.content,
        variables: template.requiredVariables || [],
        status: 'active',
        marketplaceTemplate: {
          id: template.id,
          name: template.code,
          creator: template.createdBy
            ? `${template.createdBy.firstName || ''} ${template.createdBy.lastName || ''}`.trim()
            : 'Notify Team',
        },
        createdAt: appTemplate.installationDate?.toISOString() || new Date().toISOString(),
        updatedAt: appTemplate.installationDate?.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, templateId, appId }, 'Failed to install template');
      throw error;
    }
  }

  /**
   * Submit rating for template
   */
  async submitRating(
    templateId: string,
    userId: string,
    data: {
      rating: number;
      review?: string;
    }
  ) {
    try {
      // Validate rating
      if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const review = await marketplaceRepository.submitReview(templateId, userId, data);

      // Update template rating
      await marketplaceRepository.updateTemplateRating(templateId);

      return {
        id: review.id,
        templateId,
        userId,
        rating: review.rating,
        review: review.review,
        createdAt: review.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error({ error, templateId, userId }, 'Failed to submit rating');
      throw error;
    }
  }

  /**
   * Get user's rating for template
   */
  async getUserRating(templateId: string, userId: string) {
    try {
      const rating = await marketplaceRepository.getUserRating(templateId, userId);

      if (!rating) {
        throw new Error('User has not rated this template');
      }

      return {
        id: rating.id,
        templateId,
        rating: rating.rating,
        review: rating.review,
        createdAt: rating.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error({ error, templateId, userId }, 'Failed to get user rating');
      throw error;
    }
  }

  /**
   * Get marketplace categories
   */
  async getCategories() {
    try {
      return await marketplaceRepository.getCategories();
    } catch (error) {
      logger.error({ error }, 'Failed to get categories');
      throw error;
    }
  }
}

export const marketplaceService = new MarketplaceService();

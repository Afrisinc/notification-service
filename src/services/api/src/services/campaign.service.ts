import pino from 'pino';
import {
  campaignRepository,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilters,
} from '../repositories/campaign.repository';
import { Channel } from '@prisma/client';

const logger = pino();

export class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(appId: string, data: CreateCampaignInput) {
    try {
      // Validate campaign name uniqueness
      const nameExists = await campaignRepository.nameExists(appId, data.name);
      if (nameExists) {
        throw new Error('Campaign name already exists');
      }

      const campaign = await campaignRepository.create({
        ...data,
        app_id: appId,
      });

      return this.formatCampaignResponse(campaign);
    } catch (error) {
      logger.error({ error, appId }, 'Failed to create campaign');
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(appId: string, campaignId: string) {
    try {
      const campaign = await campaignRepository.findById(campaignId, appId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      return this.formatCampaignResponse(campaign);
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to get campaign');
      throw error;
    }
  }

  /**
   * List campaigns with pagination and filtering
   */
  async listCampaigns(
    appId: string,
    options: { page?: number; limit?: number; status?: string; channel?: string; sortBy?: string; sortOrder?: string }
  ) {
    try {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));

      const { campaigns, total } = await campaignRepository.list(appId, {
        page,
        limit,
        status: options.status,
        channel: options.channel ? (options.channel.toUpperCase() as Channel) : undefined,
        sortBy: options.sortBy,
        sortOrder: (options.sortOrder as 'asc' | 'desc') || 'desc',
      });

      const formatted = campaigns.map((c: any) => this.formatCampaignResponse(c));

      return {
        appId,
        campaigns: formatted,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to list campaigns');
      throw error;
    }
  }

  /**
   * Update campaign
   */
  async updateCampaign(appId: string, campaignId: string, data: UpdateCampaignInput) {
    try {
      const campaign = await campaignRepository.findById(campaignId, appId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if campaign already sent
      if (campaign.status === 'completed' && data.status !== 'completed') {
        throw new Error('Campaign has already been sent and cannot be modified');
      }

      // Check name uniqueness if updating name
      if (data.name && data.name !== campaign.name) {
        const nameExists = await campaignRepository.nameExists(appId, data.name, campaignId);
        if (nameExists) {
          throw new Error('Campaign name already exists');
        }
      }

      const updated = await campaignRepository.update(campaignId, appId, data);

      return this.formatCampaignResponse(updated);
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to update campaign');
      throw error;
    }
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(appId: string, campaignId: string) {
    try {
      const campaign = await campaignRepository.findById(campaignId, appId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      await campaignRepository.delete(campaignId, appId);

      return {
        id: campaignId,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to delete campaign');
      throw error;
    }
  }

  /**
   * Send campaign
   */
  async sendCampaign(appId: string, campaignId: string, dryRun: boolean = false) {
    try {
      const campaign = await campaignRepository.findById(campaignId, appId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'completed') {
        throw new Error('Campaign has already been sent');
      }

      // In real scenario, this would queue the campaign for sending
      // For now, we'll simulate the send
      if (!dryRun) {
        const sentCount = campaign.recipient_count;
        const failedCount = 0;
        const deliveredCount = sentCount;

        await campaignRepository.markAsSent(campaignId, sentCount, deliveredCount, failedCount);
      }

      return {
        campaignId,
        status: 'completed',
        sentCount: campaign.recipient_count,
        failedCount: 0,
        sentAt: new Date().toISOString(),
        estimatedDeliveryTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to send campaign');
      throw error;
    }
  }

  /**
   * Schedule campaign
   */
  async scheduleCampaign(appId: string, campaignId: string, scheduledAt: string) {
    try {
      const campaign = await campaignRepository.findById(campaignId, appId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const scheduledDate = new Date(scheduledAt);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }

      const updated = await campaignRepository.schedule(campaignId, scheduledDate);

      return this.formatCampaignResponse(updated);
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to schedule campaign');
      throw error;
    }
  }

  /**
   * Duplicate campaign
   */
  async duplicateCampaign(appId: string, campaignId: string, newName: string) {
    try {
      if (!newName) {
        throw new Error('New name is required');
      }

      // Check name uniqueness
      const nameExists = await campaignRepository.nameExists(appId, newName);
      if (nameExists) {
        throw new Error('Campaign name already exists');
      }

      const duplicated = await campaignRepository.duplicate(campaignId, appId, newName);

      return this.formatCampaignResponse(duplicated);
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to duplicate campaign');
      throw error;
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(appId: string, campaignId: string) {
    try {
      const stats = await campaignRepository.getStats(campaignId, appId);

      if (!stats) {
        throw new Error('Campaign not found');
      }

      const totalRecipients = stats.recipient_count || 0;
      const deliveryRate = totalRecipients > 0 ? (stats.delivered_count / stats.sent_count) * 100 : 0;
      const openRate = stats.sent_count > 0 ? (stats.open_count / stats.sent_count) * 100 : 0;
      const clickRate = stats.sent_count > 0 ? (stats.click_count / stats.sent_count) * 100 : 0;
      const conversionRate = stats.sent_count > 0 ? (stats.conversion_count / stats.sent_count) * 100 : 0;

      return {
        campaignId: stats.id,
        name: stats.name,
        status: stats.status,
        sentAt: stats.sent_at ? stats.sent_at.toISOString() : null,
        stats: {
          totalRecipients,
          sentCount: stats.sent_count,
          deliveredCount: stats.delivered_count,
          failedCount: stats.failed_count,
          bounceCount: stats.bounce_count,
          openCount: stats.open_count,
          clickCount: stats.click_count,
          conversionCount: stats.conversion_count,
          unsubscribeCount: stats.unsubscribe_count,
        },
        rates: {
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          openRate: Math.round(openRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        timeline: {
          createdAt: stats.createdAt.toISOString(),
          sentAt: stats.sent_at ? stats.sent_at.toISOString() : null,
          completedAt: stats.completed_at ? stats.completed_at.toISOString() : null,
        },
      };
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to get campaign stats');
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  async getSummaryStats(
    appId: string,
    options: { status?: string; channel?: string; dateFrom?: string; dateTo?: string }
  ) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      const { campaigns, statusGroups, channelGroups } = await campaignRepository.getSummaryStats(appId, {
        status: options.status,
        channel: options.channel ? (options.channel.toUpperCase() as Channel) : undefined,
        dateFrom,
        dateTo,
      });

      const totalSent = campaigns.reduce((sum: number, c: any) => sum + c.sent_count, 0);
      const totalDelivered = campaigns.reduce((sum: number, c: any) => sum + c.delivered_count, 0);
      const totalFailed = campaigns.reduce((sum: number, c: any) => sum + c.failed_count, 0);
      const avgDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

      const statusMap: Record<string, number> = {};
      statusGroups.forEach((g: any) => {
        statusMap[g.status] = g._count;
      });

      const byChannel: Record<string, any> = {};
      channelGroups.forEach((g: any) => {
        const deliveryRate = g._sum.sent_count > 0 ? (g._sum.delivered_count / g._sum.sent_count) * 100 : 0;
        byChannel[g.channel.toLowerCase()] = {
          count: g._count,
          sent: g._sum.sent_count || 0,
          delivered: g._sum.delivered_count || 0,
          failed: g._sum.failed_count || 0,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
        };
      });

      return {
        appId,
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
        summary: {
          totalCampaigns: campaigns.length,
          draftCount: statusMap['draft'] || 0,
          scheduledCount: statusMap['scheduled'] || 0,
          completedCount: statusMap['completed'] || 0,
          cancelledCount: statusMap['cancelled'] || 0,
          totalSent,
          totalDelivered,
          totalFailed,
          averageDeliveryRate: Math.round(avgDeliveryRate * 100) / 100,
        },
        byChannel,
        topCampaigns: campaigns.slice(0, 5).map((c: any) => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          sentCount: c.sent_count,
          deliveredCount: c.delivered_count,
          openCount: c.open_count,
          openRate: c.sent_count > 0 ? Math.round((c.open_count / c.sent_count) * 100 * 100) / 100 : 0,
        })),
      };
    } catch (error) {
      logger.error({ error, appId }, 'Failed to get summary stats');
      throw error;
    }
  }

  /**
   * Format campaign response
   */
  private formatCampaignResponse(campaign: any) {
    return {
      id: campaign.id,
      appId: campaign.app_id,
      name: campaign.name,
      channel: campaign.channel,
      templateId: campaign.template_id,
      recipientType: campaign.recipient_type,
      recipientCount: campaign.recipient_count,
      status: campaign.status,
      sentCount: campaign.sent_count,
      deliveredCount: campaign.delivered_count,
      failedCount: campaign.failed_count,
      scheduledAt: campaign.scheduled_at ? campaign.scheduled_at.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}

export const campaignService = new CampaignService();

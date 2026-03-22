import { prismaRead, prismaWrite } from '@shared/database';
import type { Channel } from '@prisma/client';

export interface CreateCampaignInput {
  app_id: string;
  name: string;
  channel: Channel;
  template_id: string;
  recipient_type?: string;
  recipient_count?: number;
  recipient_tags?: string[];
  recipient_segment?: string;
  status?: 'draft' | 'scheduled' | 'completed' | 'cancelled';
  scheduled_at?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateCampaignInput {
  name?: string;
  recipient_type?: string;
  recipient_count?: number;
  recipient_tags?: string[];
  recipient_segment?: string;
  status?: 'draft' | 'scheduled' | 'completed' | 'cancelled';
  scheduled_at?: Date;
  metadata?: Record<string, any>;
}

export interface CampaignFilters {
  status?: string;
  channel?: Channel | undefined;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CampaignRepository {
  /**
   * Create a new campaign
   */
  async create(data: CreateCampaignInput) {
    return prismaWrite.campaign.create({
      data: {
        app_id: data.app_id,
        name: data.name,
        channel: data.channel,
        template_id: data.template_id,
        recipient_type: data.recipient_type || 'all',
        recipient_count: data.recipient_count || 0,
        recipient_tags: data.recipient_tags || [],
        recipient_segment: data.recipient_segment,
        status: data.status || 'draft',
        scheduled_at: data.scheduled_at,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Find campaign by ID
   */
  async findById(id: string, appId: string) {
    return prismaRead.campaign.findFirst({
      where: { id, app_id: appId },
    });
  }

  /**
   * List campaigns with pagination and filtering
   */
  async list(appId: string, filters: CampaignFilters & { page: number; limit: number }) {
    const skip = (filters.page - 1) * filters.limit;

    const where: any = { app_id: appId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [campaigns, total] = await Promise.all([
      prismaRead.campaign.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy,
      }),
      prismaRead.campaign.count({ where }),
    ]);

    return { campaigns, total };
  }

  /**
   * Update campaign
   */
  async update(id: string, appId: string, data: UpdateCampaignInput) {
    return prismaWrite.campaign.update({
      where: { id },
      data: {
        name: data.name,
        recipient_type: data.recipient_type,
        recipient_count: data.recipient_count,
        recipient_tags: data.recipient_tags,
        recipient_segment: data.recipient_segment,
        status: data.status,
        scheduled_at: data.scheduled_at,
        metadata: data.metadata,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete campaign
   */
  async delete(id: string, appId: string) {
    return prismaWrite.campaign.delete({
      where: { id },
    });
  }

  /**
   * Mark campaign as sent
   */
  async markAsSent(id: string, sentCount: number, deliveredCount: number, failedCount: number) {
    return prismaWrite.campaign.update({
      where: { id },
      data: {
        status: 'completed',
        sent_count: sentCount,
        delivered_count: deliveredCount,
        failed_count: failedCount,
        sent_at: new Date(),
        completed_at: new Date(),
      },
    });
  }

  /**
   * Schedule campaign
   */
  async schedule(id: string, scheduledAt: Date) {
    return prismaWrite.campaign.update({
      where: { id },
      data: {
        status: 'scheduled',
        scheduled_at: scheduledAt,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Duplicate campaign
   */
  async duplicate(campaignId: string, appId: string, newName: string) {
    const campaign = await this.findById(campaignId, appId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return prismaWrite.campaign.create({
      data: {
        app_id: campaign.app_id,
        name: newName,
        channel: campaign.channel,
        template_id: campaign.template_id,
        recipient_type: campaign.recipient_type,
        recipient_count: campaign.recipient_count,
        recipient_tags: campaign.recipient_tags,
        recipient_segment: campaign.recipient_segment,
        status: 'draft',
        metadata: campaign.metadata || {},
      },
    });
  }

  /**
   * Get campaign statistics
   */
  async getStats(id: string, appId: string) {
    return prismaRead.campaign.findFirst({
      where: { id, app_id: appId },
      select: {
        id: true,
        name: true,
        status: true,
        sent_at: true,
        completed_at: true,
        recipient_count: true,
        sent_count: true,
        delivered_count: true,
        failed_count: true,
        bounce_count: true,
        open_count: true,
        click_count: true,
        conversion_count: true,
        unsubscribe_count: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get summary statistics for campaigns
   */
  async getSummaryStats(
    appId: string,
    filters: { status?: string; channel?: Channel; dateFrom?: Date; dateTo?: Date }
  ) {
    const where: any = { app_id: appId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const campaigns = await prismaRead.campaign.findMany({
      where,
      orderBy: { sent_count: 'desc' },
      take: 100,
    });

    const statusGroups = await prismaRead.campaign.groupBy({
      by: ['status'],
      where: { app_id: appId },
      _count: true,
    });

    const channelGroups = await prismaRead.campaign.groupBy({
      by: ['channel'],
      where: { app_id: appId },
      _count: true,
      _sum: { sent_count: true, delivered_count: true, failed_count: true },
    });

    return { campaigns, statusGroups, channelGroups };
  }

  /**
   * Check if campaign name exists
   */
  async nameExists(appId: string, name: string, excludeId?: string) {
    const where: any = { app_id: appId, name };

    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const count = await prismaRead.campaign.count({ where });
    return count > 0;
  }

  /**
   * Get campaigns by status
   */
  async findByStatus(appId: string, status: any) {
    return prismaRead.campaign.findMany({
      where: { app_id: appId, status: status as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Increment stats
   */
  async incrementStats(
    id: string,
    updates: {
      sent?: number;
      delivered?: number;
      failed?: number;
      opened?: number;
      clicked?: number;
      converted?: number;
      bounced?: number;
      unsubscribed?: number;
    }
  ) {
    const data: any = { updatedAt: new Date() };

    if (updates.sent) data.sent_count = { increment: updates.sent };
    if (updates.delivered) data.delivered_count = { increment: updates.delivered };
    if (updates.failed) data.failed_count = { increment: updates.failed };
    if (updates.opened) data.open_count = { increment: updates.opened };
    if (updates.clicked) data.click_count = { increment: updates.clicked };
    if (updates.converted) data.conversion_count = { increment: updates.converted };
    if (updates.bounced) data.bounce_count = { increment: updates.bounced };
    if (updates.unsubscribed) data.unsubscribe_count = { increment: updates.unsubscribed };

    return prismaWrite.campaign.update({
      where: { id },
      data,
    });
  }
}

export const campaignRepository = new CampaignRepository();

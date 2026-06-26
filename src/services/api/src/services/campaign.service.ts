import pino from 'pino';
import { campaignRepository, CreateCampaignInput, UpdateCampaignInput } from '../repositories/campaign.repository';
import { contactRepository } from '../repositories/contact.repository';
import { notifyService } from './notify.service';
import { calculateSmsSegments } from '../utils/smsSegments';
import { prismaRead } from '@shared/database';
import { Channel } from '@prisma/client';

const logger = pino();

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN SENDING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/** Batch size for processing recipients */
const BATCH_SIZE = 100;

/** Delay between batches in milliseconds to prevent overwhelming the queue */
const BATCH_DELAY_MS = 50;

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL CONTENT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

type CampaignChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

/** Channel-specific required fields configuration */
const CHANNEL_REQUIRED_FIELDS: Record<CampaignChannel, { fields: string[]; description: string }> = {
  EMAIL: { fields: ['subject', 'html_content'], description: 'subject and html_content' },
  SMS: { fields: ['text_content'], description: 'text_content' },
  PUSH: { fields: ['push_title', 'push_body'], description: 'push_title and push_body' },
  IN_APP: { fields: ['inapp_title', 'inapp_body'], description: 'inapp_title and inapp_body' },
};

interface ChannelContentCheck {
  hasContent: boolean;
  missingFields: string[];
}

/**
 * Check if direct content is provided for a specific channel
 */
function checkChannelContent(channel: CampaignChannel, data: CreateCampaignInput): ChannelContentCheck {
  const config = CHANNEL_REQUIRED_FIELDS[channel];
  if (!config) {
    return { hasContent: false, missingFields: [] };
  }

  const missingFields = config.fields.filter((field) => !data[field as keyof CreateCampaignInput]);
  return {
    hasContent: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Get required fields description for each channel
 */
function getChannelRequiredFields(channel: CampaignChannel): string {
  return CHANNEL_REQUIRED_FIELDS[channel]?.description || 'content fields';
}

export class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(appId: string, data: CreateCampaignInput) {
    try {
      const channel = data.channel as CampaignChannel;
      const hasTemplate = !!data.template_id;
      const contentCheck = checkChannelContent(channel, data);

      // Validate: either templateId OR channel-specific direct content
      if (!hasTemplate && !contentCheck.hasContent) {
        const requiredFields = getChannelRequiredFields(channel);
        throw new Error(`Either templateId or direct content (${requiredFields}) is required for ${channel} channel`);
      }

      // Validate: cannot have both template and direct content
      if (hasTemplate && contentCheck.hasContent) {
        throw new Error('Cannot provide both templateId and direct content. Use one mode only.');
      }

      // Validate: if using direct content, ensure all required fields are present
      if (!hasTemplate && contentCheck.missingFields.length > 0) {
        throw new Error(
          `Missing required fields for ${channel} direct content: ${contentCheck.missingFields.join(', ')}`
        );
      }

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
   * Send campaign - queues notifications to all targeted recipients
   */
  async sendCampaign(appId: string, campaignId: string, dryRun: boolean = false) {
    const startTime = Date.now();

    try {
      // Fetch campaign with app relation for account_id
      const campaign = await prismaRead.campaign.findFirst({
        where: { id: campaignId, app_id: appId },
        include: { app: true, template: true },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'completed') {
        throw new Error('Campaign has already been sent');
      }

      if (campaign.status === 'sending') {
        throw new Error('Campaign is already being sent');
      }

      const accountId = campaign.app.account_id;

      // Get recipient count first
      const totalRecipients = await contactRepository.countCampaignRecipients(appId, campaign.recipient_type, {
        tags: campaign.recipient_tags,
        segment: campaign.recipient_segment || undefined,
      });

      if (totalRecipients === 0) {
        throw new Error(
          'No recipients found for this campaign. Ensure you have subscribed contacts matching the targeting criteria.'
        );
      }

      logger.info({ campaignId, appId, totalRecipients, dryRun, channel: campaign.channel }, 'Starting campaign send');

      // For dry run, just return the count without sending
      if (dryRun) {
        return {
          campaignId,
          status: 'dry_run',
          totalRecipients,
          sentCount: 0,
          failedCount: 0,
          dryRun: true,
          message: `Dry run complete. Would send to ${totalRecipients} recipients.`,
        };
      }

      // Mark campaign as sending
      await campaignRepository.markAsSending(campaignId);

      // Process recipients in batches
      const result = await this.processRecipientBatches(campaign, accountId, appId, totalRecipients);

      // Mark campaign as completed
      await campaignRepository.markAsSent(
        campaignId,
        result.sentCount,
        result.sentCount, // delivered count starts same as sent, updated via webhooks
        result.failedCount
      );

      const duration = Date.now() - startTime;
      logger.info(
        {
          campaignId,
          appId,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          durationMs: duration,
        },
        'Campaign send completed'
      );

      return {
        campaignId,
        status: 'completed',
        totalRecipients,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        sentAt: new Date().toISOString(),
        durationMs: duration,
      };
    } catch (error) {
      logger.error({ error, appId, campaignId }, 'Failed to send campaign');

      // If we started sending, revert to scheduled status for retry
      try {
        const campaign = await campaignRepository.findById(campaignId, appId);
        if (campaign?.status === 'sending') {
          await campaignRepository.update(campaignId, appId, { status: 'scheduled' });
          logger.info({ campaignId }, 'Reverted campaign status to scheduled for retry');
        }
      } catch (revertError) {
        logger.error({ revertError, campaignId }, 'Failed to revert campaign status');
      }

      throw error;
    }
  }

  /**
   * Process recipients in batches to avoid memory issues and queue overload
   */
  private async processRecipientBatches(
    campaign: any,
    accountId: string,
    appId: string,
    totalRecipients: number
  ): Promise<{ sentCount: number; failedCount: number; errors: Array<{ email: string; error: string }> }> {
    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ email: string; error: string }> = [];
    let offset = 0;

    // Prepare notification content based on campaign channel
    const notificationBase = this.prepareNotificationContent(campaign);

    while (offset < totalRecipients) {
      // Fetch batch of recipients
      const recipients = await contactRepository.findCampaignRecipients(appId, campaign.recipient_type, {
        tags: campaign.recipient_tags,
        segment: campaign.recipient_segment || undefined,
        limit: BATCH_SIZE,
        offset,
      });

      if (recipients.length === 0) break;

      // Process batch concurrently with controlled parallelism
      const batchResults = await Promise.allSettled(
        recipients.map((contact) => this.sendToRecipient(accountId, appId, contact, notificationBase, campaign))
      );

      // Count results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        if (result.status === 'fulfilled') {
          sentCount++;
        } else {
          failedCount++;
          errors.push({
            email: recipients[i].email,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      // Update campaign stats incrementally
      if (sentCount > 0 || failedCount > 0) {
        await campaignRepository.incrementStats(campaign.id, {
          sent: recipients.filter((_, i) => batchResults[i].status === 'fulfilled').length,
          failed: recipients.filter((_, i) => batchResults[i].status === 'rejected').length,
        });
      }

      offset += BATCH_SIZE;

      // Small delay between batches to prevent overwhelming the queue
      if (offset < totalRecipients) {
        await this.delay(BATCH_DELAY_MS);
      }

      logger.debug(
        { campaignId: campaign.id, processed: offset, total: totalRecipients, sentCount, failedCount },
        'Batch processed'
      );
    }

    // Log errors summary if any
    if (errors.length > 0) {
      logger.warn(
        { campaignId: campaign.id, errorCount: errors.length, sampleErrors: errors.slice(0, 5) },
        'Some campaign notifications failed'
      );
    }

    return { sentCount, failedCount, errors };
  }

  /**
   * Send notification to a single recipient
   */
  private async sendToRecipient(
    accountId: string,
    appId: string,
    contact: {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      attributes: any;
    },
    notificationBase: { channel: string; templateId?: string; payload: Record<string, any> },
    campaign: any
  ): Promise<void> {
    // Determine recipient based on channel
    let recipient: string;
    switch (campaign.channel) {
      case 'SMS':
        if (!contact.phone) {
          throw new Error('Contact has no phone number');
        }
        recipient = contact.phone;
        break;
      case 'EMAIL':
      default:
        recipient = contact.email;
        break;
    }

    // Merge contact data into payload for template personalization
    const payload = {
      ...notificationBase.payload,
      firstName: contact.first_name || '',
      lastName: contact.last_name || '',
      email: contact.email,
      ...((contact.attributes as Record<string, any>) || {}),
    };

    await notifyService.sendNotification(accountId, appId, {
      channel: campaign.channel,
      recipient,
      templateId: notificationBase.templateId,
      app_id: appId,
      payload,
      priority: 'NORMAL',
    });

    // Increment contact's notification count
    await contactRepository.incrementNotificationCount(contact.id);
  }

  /**
   * Prepare notification content from campaign
   */
  private prepareNotificationContent(campaign: any): {
    channel: string;
    templateId?: string;
    payload: Record<string, any>;
  } {
    const payload: Record<string, any> = {};

    // If using template, just pass templateId
    if (campaign.template_id) {
      return {
        channel: campaign.channel,
        templateId: campaign.template_id,
        payload: campaign.metadata || {},
      };
    }

    // Direct content mode - build payload based on channel
    switch (campaign.channel) {
      case 'EMAIL':
        payload.message = campaign.html_content;
        payload.subject = campaign.subject;
        break;
      case 'SMS':
        payload.message = campaign.text_content;
        try {
          const segmentInfo = calculateSmsSegments(campaign.text_content);
          payload.smsSegments = {
            segments: segmentInfo.segments,
            encoding: segmentInfo.encoding,
            length: segmentInfo.length,
            charsPerSegment: segmentInfo.charsPerSegment,
            charsRemaining: segmentInfo.charsRemainingInLastSegment,
          };
        } catch (e) {
          logger.debug({ error: e }, 'SMS segment calculation skipped');
        }
        break;
      case 'PUSH':
        payload.title = campaign.push_title;
        payload.message = campaign.push_body;
        payload.imageUrl = campaign.push_image_url;
        payload.actionUrl = campaign.push_action_url;
        payload.data = campaign.push_data;
        break;
      case 'IN_APP':
        payload.title = campaign.inapp_title;
        payload.message = campaign.inapp_body;
        payload.imageUrl = campaign.inapp_image_url;
        payload.actionUrl = campaign.inapp_action_url;
        payload.actionText = campaign.inapp_action_text;
        break;
    }

    return {
      channel: campaign.channel,
      payload,
    };
  }

  /**
   * Delay helper for batch processing
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
   * Format campaign response with channel-specific content
   */
  private formatCampaignResponse(campaign: any) {
    return {
      id: campaign.id,
      appId: campaign.app_id,
      name: campaign.name,
      channel: campaign.channel,
      templateId: campaign.template_id,

      // EMAIL content
      subject: campaign.subject,
      htmlContent: campaign.html_content,

      // SMS content
      textContent: campaign.text_content,

      // PUSH content
      pushTitle: campaign.push_title,
      pushBody: campaign.push_body,
      pushImageUrl: campaign.push_image_url,
      pushActionUrl: campaign.push_action_url,
      pushData: campaign.push_data,

      // IN_APP content
      inappTitle: campaign.inapp_title,
      inappBody: campaign.inapp_body,
      inappImageUrl: campaign.inapp_image_url,
      inappActionUrl: campaign.inapp_action_url,
      inappActionText: campaign.inapp_action_text,

      // Common fields
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

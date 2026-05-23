import { FastifyRequest, FastifyReply } from 'fastify';
import { campaignService } from '../services/campaign.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ApiResponseHelper } from '../utils';
import { AccountService } from '../services/account.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  SendCampaignDto,
  ScheduleCampaignDto,
  DuplicateCampaignDto,
} from '../types/campaign.types';
import pino from 'pino';

const logger = pino();
const accountService = new AccountService();

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

export async function listCampaigns(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      channel?: string;
      sortBy?: string;
      sortOrder?: string;
    };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const result = await campaignService.listCampaigns(appId, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      status: query.status,
      channel: query.channel,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return ApiResponseHelper.success(reply, 'Campaigns retrieved successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to list campaigns');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function createCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const body = req.body as CreateCampaignDto;
    const accountId = await accountService.getAccountIdByAppId(appId);

    // Basic validation: name and channel are always required
    if (!body.name || !body.channel) {
      return ApiResponseHelper.badRequest(reply, 'Name and channel are required');
    }

    // Content validation is handled by the service layer (templateId OR subject+html_content)

    const campaign = await campaignService.createCampaign(appId, {
      app_id: appId,
      name: body.name,
      channel: body.channel.toUpperCase() as any,
      template_id: body.templateId,

      // EMAIL content
      subject: body.subject,
      html_content: body.html_content,

      // SMS content
      text_content: body.text_content,

      // PUSH content
      push_title: body.push_title,
      push_body: body.push_body,
      push_image_url: body.push_image_url,
      push_action_url: body.push_action_url,
      push_data: body.push_data,

      // IN_APP content
      inapp_title: body.inapp_title,
      inapp_body: body.inapp_body,
      inapp_image_url: body.inapp_image_url,
      inapp_action_url: body.inapp_action_url,
      inapp_action_text: body.inapp_action_text,

      // Common fields
      recipient_type: body.recipientType,
      recipient_count: body.recipientCount,
      recipient_tags: body.recipientTags,
      recipient_segment: body.recipientSegment,
      status: body.status as any,
      scheduled_at: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      metadata: body.metadata,
    });

    // Track usage
    await UsageTrackingService.recordUsage(accountId, appId, 'campaigns', 1);

    return ApiResponseHelper.success(reply, 'Campaign created successfully', campaign, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('already exists')) {
      return ApiResponseHelper.conflict(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to create campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const campaign = await campaignService.getCampaign(appId, campaignId);

    return ApiResponseHelper.success(reply, 'Campaign retrieved successfully', campaign);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function updateCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    const body = req.body as UpdateCampaignDto;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const campaign = await campaignService.updateCampaign(appId, campaignId, {
      name: body.name,

      // EMAIL content
      subject: body.subject,
      html_content: body.html_content,

      // SMS content
      text_content: body.text_content,

      // PUSH content
      push_title: body.push_title,
      push_body: body.push_body,
      push_image_url: body.push_image_url,
      push_action_url: body.push_action_url,
      push_data: body.push_data,

      // IN_APP content
      inapp_title: body.inapp_title,
      inapp_body: body.inapp_body,
      inapp_image_url: body.inapp_image_url,
      inapp_action_url: body.inapp_action_url,
      inapp_action_text: body.inapp_action_text,

      // Common fields
      recipient_type: body.recipientType,
      recipient_count: body.recipientCount,
      recipient_tags: body.recipientTags,
      recipient_segment: body.recipientSegment,
      status: body.status as any,
      scheduled_at: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      metadata: body.metadata,
    });

    return ApiResponseHelper.success(reply, 'Campaign updated successfully', campaign);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    if (errorMessage.includes('already sent')) {
      return ApiResponseHelper.conflict(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to update campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function deleteCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const result = await campaignService.deleteCampaign(appId, campaignId);

    return ApiResponseHelper.success(reply, 'Campaign deleted successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to delete campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function sendCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    const body = req.body as SendCampaignDto;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const result = await campaignService.sendCampaign(appId, campaignId, body.dryRun || false);

    return ApiResponseHelper.success(reply, 'Campaign sent successfully', result);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('already been sent')) {
      return ApiResponseHelper.conflict(reply, errorMessage);
    }
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to send campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function scheduleCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    const body = req.body as ScheduleCampaignDto;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    if (!body.scheduledAt) {
      return ApiResponseHelper.badRequest(reply, 'scheduledAt is required');
    }

    const campaign = await campaignService.scheduleCampaign(appId, campaignId, body.scheduledAt);

    return ApiResponseHelper.success(reply, 'Campaign scheduled successfully', campaign);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('future')) {
      return ApiResponseHelper.badRequest(reply, errorMessage);
    }
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to schedule campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function duplicateCampaign(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    const body = req.body as DuplicateCampaignDto;
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    if (!body.newName) {
      return ApiResponseHelper.badRequest(reply, 'newName is required');
    }

    const campaign = await campaignService.duplicateCampaign(appId, campaignId, body.newName);

    return ApiResponseHelper.success(reply, 'Campaign duplicated successfully', campaign, 201);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('already exists')) {
      return ApiResponseHelper.conflict(reply, errorMessage);
    }
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to duplicate campaign');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getCampaignStats(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, campaignId } = req.params as { appId: string; campaignId: string };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const stats = await campaignService.getCampaignStats(appId, campaignId);

    return ApiResponseHelper.success(reply, 'Campaign statistics retrieved successfully', stats);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    if (errorMessage.includes('not found')) {
      return ApiResponseHelper.notFound(reply, errorMessage);
    }
    logger.error({ error: errorMessage }, 'Failed to get campaign stats');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

export async function getCampaignsSummaryStats(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const query = req.query as {
      status?: string;
      channel?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    await accountService.getAccountIdByAppId(appId); // Validates app exists

    const stats = await campaignService.getSummaryStats(appId, {
      status: query.status,
      channel: query.channel,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });

    return ApiResponseHelper.success(reply, 'Campaign summary statistics retrieved successfully', stats);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err);
    logger.error({ error: errorMessage }, 'Failed to get summary stats');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

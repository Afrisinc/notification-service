import type { FastifyInstance } from 'fastify';
import {
  listCampaigns,
  createCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  sendCampaign,
  scheduleCampaign,
  duplicateCampaign,
  getCampaignStats,
  getCampaignsSummaryStats,
} from '../controllers/campaign.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';
import { planGuards } from '../guards/plan-guard';
import {
  ListCampaignsSchema,
  CreateCampaignSchema,
  GetCampaignSchema,
  UpdateCampaignSchema,
  DeleteCampaignSchema,
  SendCampaignSchema,
  ScheduleCampaignSchema,
  DuplicateCampaignSchema,
  GetCampaignStatsSchema,
  GetCampaignsSummaryStatsSchema,
} from '../schemas/routes/campaign.schema';

export async function registerCampaignRoutes(app: FastifyInstance) {
  // List Campaigns
  app.get(
    '/apps/:appId/campaigns',
    {
      onRequest: [validateBaseToken],
      schema: ListCampaignsSchema,
    },
    listCampaigns
  );

  // Get Summary Stats (before specific ID routes)
  app.get(
    '/apps/:appId/campaigns/stats/summary',
    {
      onRequest: [validateBaseToken],
      schema: GetCampaignsSummaryStatsSchema,
    },
    getCampaignsSummaryStats
  );

  // Create Campaign
  app.post(
    '/apps/:appId/campaigns',
    {
      preHandler: [planGuards.checkEntityLimit('campaigns')],
      schema: CreateCampaignSchema,
    },
    createCampaign
  );

  // Get Campaign Stats
  app.get(
    '/apps/:appId/campaigns/:campaignId/stats',
    {
      onRequest: [validateBaseToken],
      schema: GetCampaignStatsSchema,
    },
    getCampaignStats
  );

  // Send Campaign
  app.post(
    '/apps/:appId/campaigns/:campaignId/send',
    {
      onRequest: [validateBaseToken],
      schema: SendCampaignSchema,
    },
    sendCampaign
  );

  // Schedule Campaign
  app.post(
    '/apps/:appId/campaigns/:campaignId/schedule',
    {
      onRequest: [validateBaseToken],
      schema: ScheduleCampaignSchema,
    },
    scheduleCampaign
  );

  // Duplicate Campaign
  app.post(
    '/apps/:appId/campaigns/:campaignId/duplicate',
    {
      onRequest: [validateBaseToken],
      preHandler: [planGuards.checkEntityLimit('campaigns')],
      schema: DuplicateCampaignSchema,
    },
    duplicateCampaign
  );

  // Get Single Campaign
  app.get(
    '/apps/:appId/campaigns/:campaignId',
    {
      onRequest: [validateBaseToken],
      schema: GetCampaignSchema,
    },
    getCampaign
  );

  // Update Campaign
  app.put(
    '/apps/:appId/campaigns/:campaignId',
    {
      onRequest: [validateBaseToken],
      schema: UpdateCampaignSchema,
    },
    updateCampaign
  );

  // Delete Campaign
  app.delete(
    '/apps/:appId/campaigns/:campaignId',
    {
      onRequest: [validateBaseToken],
      schema: DeleteCampaignSchema,
    },
    deleteCampaign
  );
}

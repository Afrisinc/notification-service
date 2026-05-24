/**
 * Campaign Scheduling Job
 * Runs periodically to process scheduled campaigns and send them
 */

import { CronJob } from 'cron';
import { logger } from '../config/logger';
import { campaignRepository } from '../repositories/campaign.repository';
import { campaignService } from '../services/campaign.service';

let campaignJob: CronJob | null = null;

/**
 * Initialize the campaign scheduling cron job
 * Runs every minute to check for scheduled campaigns that are due
 */
export function initializeCampaignJob(): void {
  // Run every minute to check for due campaigns
  const cronSchedule = '* * * * *';

  campaignJob = new CronJob(
    cronSchedule,
    async () => {
      try {
        await processScheduledCampaigns();
      } catch (error) {
        logger.error({ error }, 'Campaign scheduling job failed');
      }
    },
    null, // onComplete
    true, // start immediately
    'UTC' // timezone
  );

  logger.info({ schedule: cronSchedule }, 'Campaign scheduling job initialized');
}

/**
 * Process all scheduled campaigns that are due
 */
async function processScheduledCampaigns() {
  const dueCampaigns = await campaignRepository.findScheduledCampaignsDue();

  if (dueCampaigns.length === 0) {
    return { processed: 0, failed: 0 };
  }

  logger.info({ count: dueCampaigns.length }, 'Processing scheduled campaigns');

  let processed = 0;
  let failed = 0;

  for (const campaign of dueCampaigns) {
    try {
      // Mark as sending to prevent duplicate processing
      await campaignRepository.markAsSending(campaign.id);

      // Send the campaign
      await campaignService.sendCampaign(campaign.app_id, campaign.id, false);

      processed++;
      logger.info({ campaignId: campaign.id, campaignName: campaign.name }, 'Scheduled campaign sent successfully');
    } catch (error) {
      failed++;
      logger.error(
        { error, campaignId: campaign.id, campaignName: campaign.name },
        'Failed to send scheduled campaign'
      );

      // Revert status back to scheduled on failure for retry
      try {
        await campaignRepository.schedule(campaign.id, campaign.scheduled_at!);
      } catch (revertError) {
        logger.error({ error: revertError, campaignId: campaign.id }, 'Failed to revert campaign status');
      }
    }
  }

  const summary = { processed, failed, total: dueCampaigns.length };
  logger.info(summary, 'Scheduled campaign processing completed');

  return summary;
}

/**
 * Stop the campaign scheduling job
 */
export function stopCampaignJob(): void {
  if (campaignJob) {
    campaignJob.stop();
    campaignJob = null;
    logger.info('Campaign scheduling job stopped');
  }
}

/**
 * Run campaign processing manually (for testing or admin triggers)
 */
export async function runCampaignProcessingManually() {
  logger.info('Manual campaign processing triggered');
  return processScheduledCampaigns();
}

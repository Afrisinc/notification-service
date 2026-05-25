/**
 * Jobs Module
 * Exports all scheduled job initializers
 */

import { logger } from '../config/logger';
import { initializeTrialJob, stopTrialJob } from './trial.job';
import { initializeCampaignJob, stopCampaignJob } from './campaign.job';

/**
 * Initialize all scheduled jobs
 */
export function initializeJobs(): void {
  logger.info('===================================================');
  logger.info('[JOBS] Initializing scheduled jobs...');
  logger.info('===================================================');

  initializeTrialJob();
  initializeCampaignJob();

  logger.info('[OK] All scheduled jobs initialized');
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
export function stopAllJobs(): void {
  logger.info('Stopping all scheduled jobs...');
  stopTrialJob();
  stopCampaignJob();
  logger.info('All scheduled jobs stopped');
}

export { runTrialProcessingManually } from './trial.job';
export { runCampaignProcessingManually } from './campaign.job';

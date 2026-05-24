/**
 * Trial Processing Job
 * Runs periodically to send trial reminders and handle expired trials
 */

import { CronJob } from 'cron';
import { logger } from '../config/logger';
import { trialService } from '../services/trial.service';

let trialJob: CronJob | null = null;

/**
 * Initialize the trial processing cron job
 * Runs daily at 9:00 AM to check for expiring and expired trials
 */
export function initializeTrialJob(): void {
  // Run every day at 9:00 AM
  const cronSchedule = '0 9 * * *';

  trialJob = new CronJob(
    cronSchedule,
    async () => {
      logger.info('Trial processing job started');
      try {
        const results = await trialService.runTrialProcessing();
        logger.info(results, 'Trial processing job completed');
      } catch (error) {
        logger.error({ error }, 'Trial processing job failed');
      }
    },
    null, // onComplete
    true, // start immediately
    'UTC' // timezone
  );

  logger.info({ schedule: cronSchedule }, 'Trial processing job initialized');
}

/**
 * Stop the trial processing job
 */
export function stopTrialJob(): void {
  if (trialJob) {
    trialJob.stop();
    trialJob = null;
    logger.info('Trial processing job stopped');
  }
}

/**
 * Run trial processing manually (for testing or admin triggers)
 */
export async function runTrialProcessingManually() {
  logger.info('Manual trial processing triggered');
  return trialService.runTrialProcessing();
}

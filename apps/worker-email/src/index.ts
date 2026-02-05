import pino from 'pino';
import Queue from 'bull';
import { getConfig } from '@afrisinc-notify/config';
import { EmailNotification } from '@afrisinc-notify/common';
import { EmailProcessor } from './processor';

const logger = pino();

async function startEmailWorker() {
  try {
    const config = getConfig();

    // Create Bull queue
    const emailQueue = new Queue<EmailNotification>('email-notifications', {
      redis: config.REDIS_URL,
    });

    // Initialize processor
    const processor = new EmailProcessor(logger);

    // Process jobs with concurrency
    emailQueue.process(5, async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing email job');
      return processor.process(job.data);
    });

    // Handle job events
    emailQueue.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Email job completed');
    });

    emailQueue.on('failed', (job, err) => {
      logger.error({ jobId: job.id, error: err }, 'Email job failed');
    });

    logger.info('Email worker started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await emailQueue.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error(error, 'Failed to start email worker');
    process.exit(1);
  }
}

startEmailWorker();

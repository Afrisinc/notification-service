import pino from 'pino';

const logger = pino();

async function startInAppWorker() {
  try {
    logger.info('In-app worker placeholder - coming soon');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Failed to start in-app worker');
    process.exit(1);
  }
}

startInAppWorker();

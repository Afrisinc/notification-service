import pino from 'pino';
import { getConfig } from '@shared/config';
import { verifyDbConnections, closeDbConnections } from '@shared/database';
import { initAssetsClient } from '../../api/src/utils/assets-client';
import { createLmtpServer } from './lmtp-server';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: { level: (label) => ({ level: label }) },
});

async function startInboundEmailWorker() {
  const config = getConfig();

  const dbConnected = await verifyDbConnections();
  if (!dbConnected) {
    logger.error('Failed to connect to database');
    process.exit(1);
  }

  initAssetsClient(config.ASSETS_API_URL, config.ASSETS_API_KEY);

  const server = createLmtpServer({ port: config.LMTP_PORT, logger });

  await new Promise<void>((resolve) => server.listen(config.LMTP_PORT, resolve));
  logger.info({ port: config.LMTP_PORT }, 'Inbound email worker is listening for LMTP deliveries');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down inbound email worker');
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeDbConnections();
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startInboundEmailWorker().catch((error) => {
  logger.error({ error }, 'Failed to start inbound email worker');
  process.exit(1);
});

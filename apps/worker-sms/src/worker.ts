import pino from "pino";

const logger = pino();

async function startSMSWorker() {
  try {
    logger.info("SMS worker placeholder - coming soon");
    process.exit(0);
  } catch (error) {
    logger.error(error, "Failed to start SMS worker");
    process.exit(1);
  }
}

startSMSWorker();

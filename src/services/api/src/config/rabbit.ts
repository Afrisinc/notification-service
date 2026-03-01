import amqp, { Connection } from 'amqplib';
import { logger } from './logger';

/**
 * RabbitMQ Connection Factory
 * Creates a connection to RabbitMQ using environment configuration
 */
export const rabbitConnection = async (): Promise<Connection> => {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

    logger.info({ host: process.env.RABBITMQ_HOST || 'localhost' }, 'Connecting to RabbitMQ...');

    const connection = (await amqp.connect(rabbitmqUrl)) as unknown as Connection;

    logger.info('Successfully connected to RabbitMQ');

    return connection;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to connect to RabbitMQ');
    throw error;
  }
};

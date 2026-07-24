/**
 * Queue Publisher Factory
 * Creates appropriate queue publisher based on environment configuration
 *
 * Supports:
 * - guest: In-memory queue (development/testing)
 * - rabbitmq: RabbitMQ queue (future implementation)
 * - redis: Redis queue (future implementation)
 * - aws-sqs: AWS SQS (future implementation)
 */

import { getConfig } from '@shared/config';
import { logger } from '../../config/logger';
import { IQueuePublisher } from './publisher.interface';
import { GuestQueuePublisher } from './publishers/guest.publisher';
import { RabbitMQPublisher } from './publishers/rabbitmq.publisher';

export type QueueProviderType = 'guest' | 'rabbitmq' | 'redis' | 'aws-sqs';

export interface QueuePublisherConfig {
  provider: QueueProviderType;
  options?: Record<string, any>;
}

export class QueuePublisherFactory {
  /**
   * Create a queue publisher based on configuration
   */
  static async createPublisher(config: QueuePublisherConfig): Promise<IQueuePublisher> {
    logger.info({ provider: config.provider }, 'Creating queue publisher instance');

    switch (config.provider) {
      case 'guest':
        return new GuestQueuePublisher(config.options);

      case 'rabbitmq': {
        const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
        const publisher = new RabbitMQPublisher(rabbitmqUrl);
        await publisher.connect();
        return publisher;
      }

      case 'redis':
        throw new Error('Redis queue publisher not yet implemented. Use "guest" for development.');

      case 'aws-sqs':
        throw new Error('AWS SQS queue publisher not yet implemented. Use "guest" for development.');

      default:
        throw new Error(`Unknown queue provider: ${config.provider}`);
    }
  }

  /**
   * Get default configuration based on environment
   */
  static getDefaultConfig(): QueuePublisherConfig {
    const provider = getConfig().QUEUE_PROVIDER as QueueProviderType;

    return {
      provider,
      options: {
        maxRetentionMs: parseInt(process.env.QUEUE_MAX_RETENTION_MS || '86400000', 10),
        maxMessages: parseInt(process.env.QUEUE_MAX_MESSAGES || '10000', 10),
        rabbitmqUrl: process.env.RABBITMQ_URL,
      },
    };
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: QueuePublisherConfig): string[] {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('Queue provider is required');
    }

    if (!['guest', 'rabbitmq', 'redis', 'aws-sqs'].includes(config.provider)) {
      errors.push(`Unknown queue provider: ${config.provider}`);
    }

    return errors;
  }
}

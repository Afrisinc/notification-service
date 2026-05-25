/**
 * RabbitMQ Queue Publisher
 * Production-ready queue implementation using RabbitMQ/AMQP
 *
 * Features:
 * - Persistent message delivery
 * - Connection pooling & auto-reconnect
 * - Dead letter queue for failed messages
 * - Message acknowledgment
 *
 * Production: Use this in production environments
 */

import { connect } from 'amqplib';
import { logger } from '../../../config/logger';
import { IQueuePublisher, QueueMessage } from '../publisher.interface';
import { dlqConfigs, setupQueueWithDLQ } from '@shared/utils/dlq';

export class RabbitMQPublisher implements IQueuePublisher {
  private connection: any = null;
  private channel: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private exchangeName = 'notifications';
  private emailQueue = 'notifications.email';
  private emailRoutingKey = 'send_message.email';
  private smsQueue = 'notifications.sms';
  private smsRoutingKey = 'send_message.sms';

  constructor(private url: string) {}

  async connect(): Promise<void> {
    try {
      this.connection = await connect(this.url);
      if (!this.connection) {
        throw new Error('Failed to establish RabbitMQ connection');
      }
      this.channel = await this.connection.createChannel();

      // Set up exchange and queue with options
      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel');
      }

      // Setup queues with DLQ (must match worker configuration)
      await setupQueueWithDLQ(this.channel, dlqConfigs.email, logger);
      await setupQueueWithDLQ(this.channel, dlqConfigs.sms, logger);

      // Set prefetch to 1 to ensure fair distribution
      await this.channel.prefetch(1);

      logger.info(
        {
          url: this.url,
          exchange: this.exchangeName,
          queues: [
            { name: this.emailQueue, routingKey: this.emailRoutingKey },
            { name: this.smsQueue, routingKey: this.smsRoutingKey },
          ],
        },
        '✅ Connected to RabbitMQ with multi-channel setup'
      );

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Handle connection errors
      if (this.connection) {
        this.connection.on('error', (error: Error) => {
          logger.error(error, 'RabbitMQ connection error');
          this.handleConnectionError();
        });

        this.connection.on('close', () => {
          logger.warn('RabbitMQ connection closed, attempting to reconnect...');
          this.handleConnectionError();
        });
      }
    } catch (error) {
      logger.error(error, 'Failed to connect to RabbitMQ');
      this.handleConnectionError();
      throw error;
    }
  }

  private handleConnectionError(): void {
    this.channel = null;
    this.connection = null;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      logger.info({ attempt: this.reconnectAttempts, delay }, 'Attempting to reconnect to RabbitMQ...');

      setTimeout(() => {
        this.connect().catch((error) => {
          logger.error(error, 'Reconnect attempt failed');
        });
      }, delay);
    } else {
      logger.error('Max reconnect attempts reached, giving up');
    }
  }

  async publish(message: QueueMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized. Call connect() first.');
    }

    try {
      // Determine routing key based on message channel
      const channel = message.channel?.toUpperCase() || 'EMAIL';
      const routingKey = channel === 'SMS' ? this.smsRoutingKey : this.emailRoutingKey;

      const messageBuffer = Buffer.from(JSON.stringify({ msg: message, dateProduced: new Date() }));

      const published = this.channel.publish(this.exchangeName, routingKey, messageBuffer, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      if (!published) {
        throw new Error('Failed to publish message to exchange');
      }

      logger.info(
        {
          messageId: message.notificationId,
          notificationId: message.notificationId,
          tenantId: message.tenantId,
          channel: message.channel,
          recipient: message.recipient,
          exchange: this.exchangeName,
          routingKey: routingKey,
        },
        '📨 [RABBITMQ] Message published to exchange'
      );
    } catch (error) {
      logger.error({ error, messageId: message.notificationId }, 'Failed to publish message to RabbitMQ');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.channel) {
        return false;
      }

      await this.channel.checkQueue(this.emailQueue);
      await this.channel.checkQueue(this.smsQueue);
      return true;
    } catch (error) {
      logger.error(error, 'RabbitMQ health check failed');
      return false;
    }
  }

  getName(): string {
    return 'RabbitMQPublisher';
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }

      logger.info('🔌 [RABBITMQ] Disconnected from RabbitMQ');
    } catch (error) {
      logger.error(error, 'Error disconnecting from RabbitMQ');
    }
  }

  /**
   * Get queue statistics for all channels
   */
  async getQueueStats(): Promise<
    Array<{
      name: string;
      messageCount: number;
      consumerCount: number;
    }>
  > {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const [emailQueueInfo, smsQueueInfo] = await Promise.all([
      this.channel.checkQueue(this.emailQueue),
      this.channel.checkQueue(this.smsQueue),
    ]);

    return [
      {
        name: this.emailQueue,
        messageCount: emailQueueInfo.messageCount,
        consumerCount: emailQueueInfo.consumerCount,
      },
      {
        name: this.smsQueue,
        messageCount: smsQueueInfo.messageCount,
        consumerCount: smsQueueInfo.consumerCount,
      },
    ];
  }
}

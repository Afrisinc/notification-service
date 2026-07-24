import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import { setupQueueWithDLQ, sendToDLQ, type DLQConfig } from '@shared/utils/dlq';
import { getQueueRetryDelay, shouldRetryQueueMessage, sleep, type QueueRetryConfig } from '@shared/utils/retry';
import { RabbitConnection } from './connection';
import type { QueueMessage } from './types';

export type MessageHandler<T = QueueMessage> = (message: T) => Promise<void>;

export interface RabbitConsumerOptions {
  url: string;
  dlqConfig: DLQConfig;
  retryConfig: QueueRetryConfig;
  logger: Logger;
  prefetch?: number;
}

export class RabbitConsumer<T = QueueMessage> {
  private readonly connection: RabbitConnection;
  private channel: Channel | null = null;
  private handler: MessageHandler<T> | null = null;
  private stopping = false;

  constructor(private readonly options: RabbitConsumerOptions) {
    this.connection = new RabbitConnection({
      url: options.url,
      name: `consumer:${options.dlqConfig.mainQueue}`,
      logger: options.logger,
    });
    this.connection.onReconnect(async () => {
      if (this.handler) await this.subscribe();
    });
  }

  async start(handler: MessageHandler<T>): Promise<void> {
    this.handler = handler;
    await this.connection.connect();
    await this.subscribe();
  }

  private async subscribe(): Promise<void> {
    const { dlqConfig, logger, prefetch = 1 } = this.options;

    const channel = await this.connection.createChannel();
    await setupQueueWithDLQ(channel, dlqConfig, logger);
    await channel.prefetch(prefetch);

    channel.on('error', (err: Error) => {
      logger.error({ queue: dlqConfig.mainQueue, error: err.message }, 'Consumer channel error');
    });

    channel.on('close', () => {
      if (this.channel === channel) this.channel = null;
      if (!this.stopping && this.handler && this.connection.isConnected()) {
        this.subscribe().catch((err) =>
          logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to resubscribe consumer')
        );
      }
    });

    this.channel = channel;

    await channel.consume(dlqConfig.mainQueue, (msg) => this.handle(msg), { noAck: false });

    logger.info({ queue: dlqConfig.mainQueue }, 'Consumer subscribed and awaiting messages');
  }

  private async handle(msg: ConsumeMessage | null): Promise<void> {
    if (!msg || this.stopping || !this.channel) return;

    const { dlqConfig, retryConfig, logger } = this.options;
    const channel = this.channel;
    const headers = msg.properties.headers ?? {};
    const retryCount = (headers['x-retry-count'] as number) ?? 0;
    const startedAt = Date.now();

    let message: T;
    try {
      const parsed = JSON.parse(msg.content.toString());
      message = (parsed.msg ?? parsed) as T;
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Discarding unparseable message');
      channel.ack(msg);
      return;
    }

    const notificationId = (message as { notificationId?: string }).notificationId ?? 'unknown';

    try {
      await this.handler!(message);
      channel.ack(msg);
      logger.info({ notificationId, durationMs: Date.now() - startedAt, retryCount }, 'Message processed');
      return;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ notificationId, retryCount, error: error.message }, 'Message processing failed');

      if (shouldRetryQueueMessage(retryConfig, retryCount)) {
        const delay = getQueueRetryDelay(retryConfig, retryCount);
        await sleep(delay);

        channel.publish(dlqConfig.mainExchange, dlqConfig.mainRoutingKey, msg.content, {
          persistent: true,
          headers: {
            ...headers,
            'x-retry-count': retryCount + 1,
            'x-last-error': error.message,
            'x-last-retry-at': new Date().toISOString(),
          },
        });
        channel.ack(msg);
        logger.info({ notificationId, nextRetry: retryCount + 1, delayMs: delay }, 'Message re-queued for retry');
      } else {
        await sendToDLQ(channel, dlqConfig.dlxExchange, dlqConfig.dlqRoutingKey, msg.content, headers, error, logger);
        channel.ack(msg);
        logger.error({ notificationId, retryCount }, 'Retries exhausted, message sent to DLQ');
      }
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    await this.connection.close();
  }
}

import type { ConfirmChannel } from 'amqplib';
import type { Logger } from 'pino';
import { dlqConfigs, setupQueueWithDLQ, type DLQConfig } from '@shared/utils/dlq';
import { RabbitConnection } from './connection';
import type { QueueMessage, NotificationChannel, QueueEnvelope } from './types';

const ROUTES = {
  EMAIL: dlqConfigs.email,
  SMS: dlqConfigs.sms,
  IN_APP: dlqConfigs.inapp,
} satisfies Partial<Record<NotificationChannel, DLQConfig>>;

const PUBLISH_CONFIRM_TIMEOUT_MS = 10000;

export interface RabbitPublisherOptions {
  url: string;
  logger: Logger;
}

export class RabbitPublisher {
  private readonly connection: RabbitConnection;
  private channel: ConfirmChannel | null = null;
  private closing = false;

  constructor(private readonly options: RabbitPublisherOptions) {
    this.connection = new RabbitConnection({
      url: options.url,
      name: 'publisher',
      logger: options.logger,
    });
    this.connection.onReconnect(async () => {
      await this.setupChannel();
    });
  }

  async connect(): Promise<void> {
    await this.connection.connect();
    await this.setupChannel();
  }

  private async setupChannel(): Promise<void> {
    const { logger } = this.options;
    const channel = await this.connection.createConfirmChannel();

    for (const config of Object.values(ROUTES)) {
      await setupQueueWithDLQ(channel, config, logger);
    }

    channel.on('return', (msg) => {
      logger.error({ routingKey: msg.fields.routingKey }, 'Message returned as unroutable, not delivered to any queue');
    });

    channel.on('error', (err: Error) => {
      logger.error({ error: err.message }, 'Publisher channel error');
    });

    channel.on('close', () => {
      if (this.channel === channel) this.channel = null;
      if (!this.closing && this.connection.isConnected()) {
        this.setupChannel().catch((err) =>
          logger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Failed to rebuild publisher channel'
          )
        );
      }
    });

    this.channel = channel;
  }

  async publish(message: QueueMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Publisher channel not initialized. Call connect() first.');
    }

    const route = ROUTES[message.channel as keyof typeof ROUTES];
    if (!route) {
      throw new Error(`No queue configured for channel: ${message.channel}`);
    }

    const envelope: QueueEnvelope = { msg: message, dateProduced: new Date().toISOString() };
    const content = Buffer.from(JSON.stringify(envelope));

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Publish confirm timed out')), PUBLISH_CONFIRM_TIMEOUT_MS);
      try {
        this.channel!.publish(
          route.mainExchange,
          route.mainRoutingKey,
          content,
          { persistent: true, mandatory: true, contentType: 'application/json', timestamp: Date.now() },
          (err) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve();
          }
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err as Error);
      }
    });

    this.options.logger.info(
      {
        notificationId: message.notificationId,
        channel: message.channel,
        routingKey: route.mainRoutingKey,
      },
      'Message published and confirmed by broker'
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.channel) return false;
      await this.channel.checkExchange(dlqConfigs.email.mainExchange);
      return true;
    } catch {
      return false;
    }
  }

  getChannel(): ConfirmChannel | null {
    return this.channel;
  }

  getName(): string {
    return 'RabbitPublisher';
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    await this.connection.close();
  }
}

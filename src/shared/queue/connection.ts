import amqp from 'amqplib';
import type { Channel, ConfirmChannel } from 'amqplib';
import type { Logger } from 'pino';

export interface RabbitConnectionOptions {
  url: string;
  name: string;
  logger: Logger;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
}

type ReconnectHandler = () => Promise<void>;

export class RabbitConnection {
  private connection: any = null;
  private connecting: Promise<void> | null = null;
  private closing = false;
  private attempts = 0;
  private readonly reconnectHandlers = new Set<ReconnectHandler>();

  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelayMs: number;

  constructor(private readonly options: RabbitConnectionOptions) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5000;
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    if (this.connecting !== null) return this.connecting;

    this.connecting = this.establish();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async establish(): Promise<void> {
    const { url, name, logger } = this.options;

    this.connection = await amqp.connect(url);
    this.attempts = 0;
    logger.info({ connection: name }, 'RabbitMQ connection established');

    this.connection.on('error', (err: Error) => {
      logger.error({ connection: name, error: err.message }, 'RabbitMQ connection error');
    });

    this.connection.on('close', () => {
      this.connection = null;
      if (this.closing) return;
      logger.warn({ connection: name }, 'RabbitMQ connection closed unexpectedly, scheduling reconnect');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    const { name, logger } = this.options;

    if (this.attempts >= this.maxReconnectAttempts) {
      logger.error({ connection: name, attempts: this.attempts }, 'RabbitMQ max reconnect attempts reached');
      return;
    }

    this.attempts += 1;
    const delay = this.reconnectDelayMs * this.attempts;

    setTimeout(async () => {
      try {
        if (!this.connection) await this.establish();
        for (const handler of this.reconnectHandlers) {
          await handler();
        }
        logger.info({ connection: name }, 'RabbitMQ reconnected and consumers/publishers restored');
      } catch (err) {
        logger.error(
          { connection: name, error: err instanceof Error ? err.message : String(err) },
          'RabbitMQ reconnect attempt failed'
        );
        this.scheduleReconnect();
      }
    }, delay);
  }

  onReconnect(handler: ReconnectHandler): void {
    this.reconnectHandlers.add(handler);
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    await this.connect();
    return this.connection.createConfirmChannel();
  }

  async createChannel(): Promise<Channel> {
    await this.connect();
    return this.connection.createChannel();
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

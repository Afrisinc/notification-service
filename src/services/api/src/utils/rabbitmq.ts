import crypto from 'node:crypto';
import { logger } from '../config/logger';
import { rabbitConnection } from '../config/rabbit';
import { Channel, Message, ConsumeMessage } from 'amqplib';

const defaultQueueOptions = { durable: true, persistent: true };
const defaultConsumptionOptions = { durable: true };

interface ActiveConsumers {
  queueName: string;
  handler: (msg: Message, channel: Channel) => Promise<void>;
  routingKey: string;
  exchangeName: string;
  options: any;
}

interface ActiveBinding {
  exchange: string;
  queue: string;
  routingKey: string;
}

/**
 * RabbitMQ Exchange Manager
 *
 * Manages RabbitMQ connections, channels, and message consumers
 * Features:
 * - Connection pooling with automatic recovery
 * - Consumer and publisher channel management
 * - Queue/exchange binding and recovery
 * - Graceful shutdown
 */
export class RabbitMQExchange {
  static connection: any;
  static consumerChannel: Channel | null;
  static publisherChannel: Channel | null;
  static activeConsumers = [] as ActiveConsumers[];
  static activeBindings = [] as ActiveBinding[];

  // --- CORE CONNECTION HANDLING ---
  static async getConnection(): Promise<any> {
    if (!this.connection) {
      this.connection = await rabbitConnection();

      if (this.connection) {
        this.connection.on('close', async () => {
          logger.warn('RabbitMQ connection closed — attempting recovery...');
          this.connection = null;
          this.consumerChannel = null;
          this.publisherChannel = null;
          await this.recover();
        });

        this.connection.on('error', (err: Error) => {
          logger.error({ error: err.message }, 'RabbitMQ connection error');
        });
      }
    }

    return this.connection;
  }

  static async createChannel(type = 'consumer') {
    const connection = await this.getConnection();
    const channel = (await connection.createChannel()) as Channel;

    channel.on('error', (err: Error) => {
      logger.error({ error: err.message, type }, `RabbitMQ ${type} channel error`);
    });

    channel.on('close', async () => {
      logger.warn(`RabbitMQ ${type} channel closed. Recovering...`);
      if (type === 'consumer') {
        this.consumerChannel = null;
        await this.recoverConsumers();
      } else if (type === 'publisher') {
        this.publisherChannel = null;
      }
    });

    return channel;
  }

  // --- CONSUMER CREATION ---
  static async messageConsumer(
    queueName: string,
    handler: (msg: Message, channel: Channel) => Promise<void>,
    routingKey: string,
    exchangeName: string,
    options = defaultConsumptionOptions
  ) {
    const consumerId = crypto.randomUUID();
    logger.info(`Setting up consumer ${consumerId} on [${exchangeName}/${queueName}]`);

    if (!this.consumerChannel) {
      this.consumerChannel = await this.createChannel('consumer');
    }

    const channel = this.consumerChannel;

    // Ensure exchange and queue exist
    await channel.assertExchange(exchangeName, 'direct', options);
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, exchangeName, routingKey);

    const wrappedHandler = async (msg: ConsumeMessage | null) => {
      try {
        if (!msg) return;

        logger.debug({ queueName, consumerId }, 'Message received from queue');

        // Pass raw message to handler - handler manages parsing
        await handler(msg as Message, channel);
      } catch (error: any) {
        logger.error({ error: error.message, queueName, consumerId }, 'Error processing message');
      }
    };

    if (!channel) {
      throw new Error('Failed to create consumer channel');
    }

    const { consumerTag } = await channel.consume(queueName, wrappedHandler, { noAck: false });
    logger.info({ consumerId, consumerTag, queueName }, 'Consumer active on queue');

    // Save for recovery
    this.activeConsumers.push({ queueName, handler, routingKey, exchangeName, options });
    return consumerTag;
  }

  // --- PUBLISHER CREATION ---
  static async messagePublisher(exchangeName: string, options = defaultQueueOptions, exchangeType = 'direct') {
    if (!this.publisherChannel) {
      this.publisherChannel = await this.createChannel('publisher');
    }

    const channel = this.publisherChannel;
    await channel.assertExchange(exchangeName, exchangeType, options);

    channel.on('return', (msg) => {
      const content = msg.content.toString();
      logger.warn(`Message returned (unroutable): ${content}`);
    });

    return (routingKey: string, msg: Message, publishingOptions = { persistent: true, mandatory: true }) => {
      const payload = JSON.stringify({ msg, dateProduced: new Date() });
      const result = channel.publish(exchangeName, routingKey, Buffer.from(payload), publishingOptions);
      if (!result) {
        logger.warn('Publish backpressure detected!');
      }
      return result;
    };
  }

  // --- QUEUE / EXCHANGE BINDING ---
  static async setupQueueBinding(bindings: ActiveBinding[] = []) {
    try {
      const connection = await this.getConnection();
      const channel = await connection.createChannel();

      for (const { exchange, queue, routingKey } of bindings) {
        await channel.assertExchange(exchange, 'direct', { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, routingKey);
        logger.info({ queue, exchange, routingKey }, 'Queue bound to exchange');
      }

      // Store bindings for recovery
      this.activeBindings = bindings;
      await channel.close();
      logger.info({ count: bindings.length }, 'RabbitMQ queues and exchanges set up successfully');
    } catch (err: Error | any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Error setting up RabbitMQ bindings');
    }
  }

  // --- RECOVERY WORKFLOW ---
  static async recover() {
    try {
      logger.info('Recovering RabbitMQ connection...');
      await this.getConnection();
      await this.recoverBindings();
      await this.recoverConsumers();
      logger.info('RabbitMQ recovery completed');
    } catch (err: Error | any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'RabbitMQ recovery failed, retrying in 5s');
      setTimeout(() => this.recover(), 5000);
    }
  }

  static async recoverBindings() {
    if (!this.activeBindings.length) return;
    logger.info({ count: this.activeBindings.length }, 'Recreating RabbitMQ exchanges, queues, and bindings');
    await this.setupQueueBinding(this.activeBindings);
  }

  static async recoverConsumers() {
    if (!this.activeConsumers.length) return;
    logger.info({ count: this.activeConsumers.length }, 'Re-subscribing all RabbitMQ consumers');
    const consumers = [...this.activeConsumers];
    this.activeConsumers = [];
    for (const c of consumers) {
      try {
        await this.messageConsumer(c.queueName, c.handler, c.routingKey, c.exchangeName, c.options);
        logger.info({ queueName: c.queueName }, 'Recovered consumer for queue');
      } catch (err: Error | any) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ queueName: c.queueName, error: errorMessage }, 'Failed to recover consumer');
      }
    }
  }

  // --- SHUTDOWN ---
  static async shutdown() {
    try {
      if (this.consumerChannel) {
        await this.consumerChannel.close();
      }
      if (this.publisherChannel) {
        await this.publisherChannel.close();
      }
      if (this.connection) {
        await (this.connection as any).close();
      }
      logger.info('RabbitMQ connection and channels closed cleanly');
    } catch (err: Error | any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Error during RabbitMQ shutdown');
    }
  }
}

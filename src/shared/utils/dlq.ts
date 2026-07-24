import type { Channel } from 'amqplib';
import pino from 'pino';
import { RABBIT_CONSTANTS } from '../queue/constants';

export interface DLQConfig {
  mainExchange: string;
  mainQueue: string;
  mainRoutingKey: string;
  dlxExchange: string;
  dlqQueue: string;
  dlqRoutingKey: string;
  messageTtl?: number;
  maxRetries: number;
}

const defaultLogger = pino({ level: 'info' });

export async function setupQueueWithDLQ(channel: Channel, config: DLQConfig, logger?: pino.Logger): Promise<void> {
  const log = logger || defaultLogger;

  log.info({ config: config.mainQueue }, 'Setting up queue with DLQ');

  await channel.assertExchange(config.dlxExchange, 'direct', { durable: true });

  await channel.assertQueue(config.dlqQueue, {
    durable: true,
    arguments: {
      'x-queue-type': 'classic',
    },
  });

  await channel.bindQueue(config.dlqQueue, config.dlxExchange, config.dlqRoutingKey);

  await channel.assertExchange(config.mainExchange, 'direct', { durable: true });

  const mainQueueArgs: Record<string, any> = {
    'x-dead-letter-exchange': config.dlxExchange,
    'x-dead-letter-routing-key': config.dlqRoutingKey,
  };

  if (config.messageTtl) {
    mainQueueArgs['x-message-ttl'] = config.messageTtl;
  }

  await channel.assertQueue(config.mainQueue, {
    durable: true,
    arguments: mainQueueArgs,
  });

  await channel.bindQueue(config.mainQueue, config.mainExchange, config.mainRoutingKey);

  log.info(
    {
      mainQueue: config.mainQueue,
      dlqQueue: config.dlqQueue,
      dlxExchange: config.dlxExchange,
    },
    'Queue with DLQ setup complete'
  );
}

export function shouldSendToDLQ(retryCount: number, maxRetries: number): boolean {
  return retryCount >= maxRetries;
}

export async function sendToDLQ(
  channel: Channel,
  dlxExchange: string,
  dlqRoutingKey: string,
  message: Buffer,
  originalHeaders: Record<string, any>,
  error: Error,
  logger?: pino.Logger
): Promise<void> {
  const log = logger || defaultLogger;

  const dlqHeaders = {
    ...originalHeaders,
    'x-dlq-reason': error.message,
    'x-dlq-timestamp': new Date().toISOString(),
    'x-original-exchange': originalHeaders['x-first-death-exchange'] || 'unknown',
    'x-original-routing-key': originalHeaders['x-first-death-routing-key'] || 'unknown',
    'x-death-count': (originalHeaders['x-death-count'] || 0) + 1,
  };

  channel.publish(dlxExchange, dlqRoutingKey, message, {
    persistent: true,
    headers: dlqHeaders,
  });

  log.warn(
    {
      dlxExchange,
      dlqRoutingKey,
      reason: error.message,
      retryCount: originalHeaders['x-retry-count'],
    },
    'Message sent to DLQ'
  );
}

export async function reprocessFromDLQ(
  channel: Channel,
  dlqQueue: string,
  targetExchange: string,
  targetRoutingKey: string,
  limit: number = 100,
  logger?: pino.Logger
): Promise<{ processed: number; failed: number }> {
  const log = logger || defaultLogger;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const msg = await channel.get(dlqQueue, { noAck: false });

    if (!msg) {
      break;
    }

    try {
      const headers = { ...msg.properties.headers, 'x-retry-count': 0, 'x-reprocessed-from-dlq': true };

      channel.publish(targetExchange, targetRoutingKey, msg.content, {
        persistent: true,
        headers,
      });

      channel.ack(msg);
      processed++;
    } catch {
      channel.nack(msg, false, true);
      failed++;
    }
  }

  log.info({ processed, failed, dlqQueue }, 'DLQ reprocessing complete');
  return { processed, failed };
}

const { EXCHANGES, QUEUES, ROUTING_KEYS, MAX_RETRIES } = RABBIT_CONSTANTS;

export const dlqConfigs: Record<'request' | 'email' | 'sms' | 'inapp', DLQConfig> = {
  request: {
    mainExchange: EXCHANGES.MAIN,
    mainQueue: QUEUES.REQUEST.SEND,
    mainRoutingKey: ROUTING_KEYS.REQUEST.SEND,
    dlxExchange: EXCHANGES.DLX,
    dlqQueue: QUEUES.REQUEST.DLQ,
    dlqRoutingKey: ROUTING_KEYS.REQUEST.DLQ,
    maxRetries: MAX_RETRIES.REQUEST,
  },
  email: {
    mainExchange: EXCHANGES.MAIN,
    mainQueue: QUEUES.EMAIL.SEND,
    mainRoutingKey: ROUTING_KEYS.EMAIL.SEND,
    dlxExchange: EXCHANGES.DLX,
    dlqQueue: QUEUES.EMAIL.DLQ,
    dlqRoutingKey: ROUTING_KEYS.EMAIL.DLQ,
    maxRetries: MAX_RETRIES.EMAIL,
  },
  sms: {
    mainExchange: EXCHANGES.MAIN,
    mainQueue: QUEUES.SMS.SEND,
    mainRoutingKey: ROUTING_KEYS.SMS.SEND,
    dlxExchange: EXCHANGES.DLX,
    dlqQueue: QUEUES.SMS.DLQ,
    dlqRoutingKey: ROUTING_KEYS.SMS.DLQ,
    maxRetries: MAX_RETRIES.SMS,
  },
  inapp: {
    mainExchange: EXCHANGES.MAIN,
    mainQueue: QUEUES.IN_APP.SEND,
    mainRoutingKey: ROUTING_KEYS.IN_APP.SEND,
    dlxExchange: EXCHANGES.DLX,
    dlqQueue: QUEUES.IN_APP.DLQ,
    dlqRoutingKey: ROUTING_KEYS.IN_APP.DLQ,
    maxRetries: MAX_RETRIES.IN_APP,
  },
};

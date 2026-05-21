import type { Channel } from 'amqplib';
import pino from 'pino';

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

export const dlqConfigs = {
  email: {
    mainExchange: 'notifications',
    mainQueue: 'notifications.email',
    mainRoutingKey: 'send_message.email',
    dlxExchange: 'notifications.dlx',
    dlqQueue: 'notifications.email.dlq',
    dlqRoutingKey: 'dlq.email',
    maxRetries: 5,
  },
  sms: {
    mainExchange: 'notifications',
    mainQueue: 'notifications.sms',
    mainRoutingKey: 'send_message.sms',
    dlxExchange: 'notifications.dlx',
    dlqQueue: 'notifications.sms.dlq',
    dlqRoutingKey: 'dlq.sms',
    maxRetries: 3,
  },
  inapp: {
    mainExchange: 'notifications',
    mainQueue: 'notifications.inapp',
    mainRoutingKey: 'send_message.inapp',
    dlxExchange: 'notifications.dlx',
    dlqQueue: 'notifications.inapp.dlq',
    dlqRoutingKey: 'dlq.inapp',
    maxRetries: 3,
  },
};

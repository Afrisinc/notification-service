import type { Channel } from 'amqplib';
import { dlqConfigs } from '@shared/utils/dlq';
import type { CheckResult } from '../../types/shared';

const PUBLISHER_EXCHANGE = dlqConfigs.email.mainExchange;
const CONSUMER_QUEUE = dlqConfigs.request.mainQueue;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function probe(
  channel: Channel | null,
  label: string,
  op: (ch: Channel) => Promise<unknown>
): Promise<CheckResult> {
  if (!channel) return { status: 'down', error: `${label} channel not initialized` };
  const start = Date.now();
  try {
    await withTimeout(op(channel), 1000, label);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'down', error: err?.message || 'unknown error' };
  }
}

export async function checkQueueHealth(
  publisherChannel: Channel | null,
  consumerChannel: Channel | null
): Promise<{ statusCode: number; rabbit: { consumer: CheckResult; publisher: CheckResult } }> {
  const [publisher, consumer] = await Promise.all([
    probe(publisherChannel, 'publisher', (ch) => ch.checkExchange(PUBLISHER_EXCHANGE)),
    probe(consumerChannel, 'consumer', (ch) => ch.checkQueue(CONSUMER_QUEUE)),
  ]);

  const allUp = publisher.status === 'up' && consumer.status === 'up';
  return {
    statusCode: allUp ? 200 : 503,
    rabbit: { consumer, publisher },
  };
}

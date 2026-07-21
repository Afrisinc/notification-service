import { Channel } from 'amqplib';
import { CheckResult } from '../../types/shared';
import { prismaRead, prismaWrite } from '../database';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

export async function checkRabbitHealth(
  consumerChannel: Channel | null,
  publisherChannel: Channel | null
): Promise<{ statusCode: number; rabbit: Record<string, CheckResult> }> {
  const checkOne = async (channel: Channel | null, label: string): Promise<CheckResult> => {
    const start = Date.now();
    if (!channel) {
      return { status: 'down', error: `${label} not initialized` };
    }
    try {
      await withTimeout(channel.checkExchange('amq.direct'), 1000, label);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: 'down', error: err?.message || 'unknown error' };
    }
  };

  const [consumer, publisher] = await Promise.all([
    checkOne(consumerChannel, 'consumerChannel'),
    checkOne(publisherChannel, 'publisherChannel'),
  ]);

  const allUp = consumer.status === 'up' && publisher.status === 'up';

  return {
    statusCode: allUp ? 200 : 503,
    rabbit: { consumer, publisher },
  };
}
export async function checkDBHealth(): Promise<{
  statusCode: number;
  db: Record<string, CheckResult>;
}> {
  const checkClient = async (client: any, label: string): Promise<CheckResult> => {
    const start = Date.now();
    try {
      await withTimeout(client.$queryRaw`SELECT 1`, 1500, label);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: 'down', error: err?.message || 'unknown error' };
    }
  };

  const [read, write] = await Promise.all([checkClient(prismaRead, 'db_read'), checkClient(prismaWrite, 'db_write')]);

  const allUp = read.status === 'up' && write.status === 'up';

  return {
    statusCode: allUp ? 200 : 503,
    db: { read, write },
  };
}

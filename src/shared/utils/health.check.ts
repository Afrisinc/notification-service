import { CheckResult } from '../../types/shared';
import { prismaRead, prismaWrite } from '../database';

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
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

import { checkQueueHealth } from '@shared/queue';
import { getQueuePublisher } from '../services/notify.service';
import { getNotificationIntakeChannel } from '../consumers/notification-intake.consumer';

export type RabbitHealth = Awaited<ReturnType<typeof checkQueueHealth>>;

export async function resolveRabbitHealth(): Promise<RabbitHealth> {
  let publisher;
  try {
    publisher = getQueuePublisher();
  } catch {
    const down = { status: 'down' as const, error: 'queue publisher not initialized' };
    return { statusCode: 503, rabbit: { consumer: down, publisher: down } };
  }

  const publisherChannel = publisher.getChannel?.() ?? null;
  if (publisherChannel) {
    return checkQueueHealth(publisherChannel, getNotificationIntakeChannel());
  }

  const healthy = await publisher.healthCheck();
  const result = healthy
    ? { status: 'up' as const, latencyMs: 0 }
    : { status: 'down' as const, error: 'queue publisher unavailable' };

  return { statusCode: healthy ? 200 : 503, rabbit: { consumer: result, publisher: result } };
}

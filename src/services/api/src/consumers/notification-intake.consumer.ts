import type { Channel } from 'amqplib';
import { RabbitConsumer } from '@shared/queue';
import { dlqConfigs } from '@shared/utils/dlq';
import { queueRetryConfigs } from '@shared/utils/retry';
import { getConfig } from '@shared/config';
import { logger } from '../config/logger';
import { notifyService, SendNotificationRequest } from '../services/notify.service';
import { appRepository } from '../repositories/app.repository';

let consumer: RabbitConsumer<SendNotificationRequest> | null = null;

export function getNotificationIntakeChannel(): Channel | null {
  return consumer?.getChannel() ?? null;
}

export async function startNotificationIntakeConsumer(): Promise<void> {
  const config = getConfig();

  consumer = new RabbitConsumer<SendNotificationRequest>({
    url: config.RABBITMQ_URL,
    dlqConfig: dlqConfigs.request,
    retryConfig: queueRetryConfigs.request,
    logger,
  });

  await consumer.start(async (message) => {
    if (!message.app_id) {
      throw new Error('Notification intake message must include app_id');
    }

    const accountId = await appRepository.getAccountIdByAppId(message.app_id);
    if (!accountId) {
      throw new Error(`No account found for app_id: ${message.app_id}`);
    }

    await notifyService.sendNotification(accountId, message.app_id, message);
  });
}

export async function stopNotificationIntakeConsumer(): Promise<void> {
  if (consumer) {
    await consumer.stop();
    consumer = null;
  }
}

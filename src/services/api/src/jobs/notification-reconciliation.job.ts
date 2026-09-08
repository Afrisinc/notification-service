import { CronJob } from 'cron';
import { logger } from '../config/logger';
import { prismaRead, prismaWrite } from '@shared/database';
import { refundFailedNotification } from '@shared/billing/payg-refund';
import { adminAlerts } from '../services/admin-alerts.service';

const STALE_MS = 15 * 60 * 1000;
const BATCH_LIMIT = 200;

interface ReconciliationStats {
  staleResolved: number;
  refunded: number;
  refundedAmount: number;
  errors: number;
  startedAt: Date;
  completedAt: Date;
}

let reconciliationJob: CronJob | null = null;
let isRunning = false;

export function initializeNotificationReconciliationJob(): void {
  const cronSchedule = '0 */5 * * * *';

  reconciliationJob = new CronJob(
    cronSchedule,
    async () => {
      try {
        await runNotificationReconciliation();
      } catch (error) {
        logger.error({ error }, 'Notification reconciliation job failed');
      }
    },
    null,
    true,
    'UTC'
  );

  logger.info({ schedule: cronSchedule }, 'Notification reconciliation job initialized');
}

export function stopNotificationReconciliationJob(): void {
  if (reconciliationJob) {
    reconciliationJob.stop();
    reconciliationJob = null;
    logger.info('Notification reconciliation job stopped');
  }
}

async function resolveStuckNotifications(cutoff: Date, stats: ReconciliationStats): Promise<void> {
  const stuck = await prismaRead.notification.findMany({
    where: { status: { in: ['PENDING', 'QUEUED'] }, createdAt: { lt: cutoff } },
    take: BATCH_LIMIT,
  });

  for (const notification of stuck) {
    try {
      const existingPayload = (notification.payload as Record<string, any>) ?? {};

      await prismaWrite.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          payload: {
            ...existingPayload,
            errorMessage:
              existingPayload.errorMessage ||
              'Notification did not reach a terminal state within the expected processing window',
            deliveryStatus: 'failed',
          },
        },
      });

      await prismaWrite.notificationLog.create({
        data: {
          notificationId: notification.id,
          provider: 'reconciliation-job',
          channel: notification.channel,
          status: 'FAILED',
          response: {
            error: 'Reconciled: notification stuck without a terminal status',
            reconciledAt: new Date().toISOString(),
          },
        },
      });

      stats.staleResolved++;
    } catch (error) {
      stats.errors++;
      logger.error(
        { notificationId: notification.id, error: error instanceof Error ? error.message : error },
        'Failed to resolve stuck notification'
      );
    }
  }
}

async function refundFailedUnrefundedNotifications(cutoff: Date, stats: ReconciliationStats): Promise<void> {
  const candidates = await prismaRead.notification.findMany({
    where: { status: 'FAILED', refundedAt: null, createdAt: { lt: cutoff } },
    take: BATCH_LIMIT,
  });

  let insufficientBalanceCount = 0;
  let lastInsufficientBalanceError = '';

  for (const notification of candidates) {
    try {
      const payload = (notification.payload as Record<string, any>) ?? {};
      const errorMessage: string = payload.errorMessage || '';

      if (errorMessage.includes('InsufficientBalance')) {
        insufficientBalanceCount++;
        lastInsufficientBalanceError = errorMessage;
      }

      const result = await refundFailedNotification(
        notification.id,
        'Notification failed permanently — reconciliation job'
      );

      if (result.refunded) {
        stats.refunded++;
        stats.refundedAmount = Number.parseFloat((stats.refundedAmount + result.amount).toFixed(6));
        logger.info(
          { notificationId: notification.id, amount: result.amount, newBalance: result.newBalance },
          'PAYG credits refunded via reconciliation job'
        );
      }
    } catch (error) {
      stats.errors++;
      logger.error(
        { notificationId: notification.id, error: error instanceof Error ? error.message : error },
        'Failed to refund notification via reconciliation job'
      );
    }
  }

  if (insufficientBalanceCount > 0) {
    await adminAlerts
      .providerFailure(
        "Africa's Talking",
        lastInsufficientBalanceError || 'InsufficientBalance',
        insufficientBalanceCount
      )
      .catch((error) => {
        logger.error({ error }, 'Failed to send insufficient balance admin alert');
      });
  }
}

export async function runNotificationReconciliation(): Promise<ReconciliationStats> {
  const emptyStats: ReconciliationStats = {
    staleResolved: 0,
    refunded: 0,
    refundedAmount: 0,
    errors: 0,
    startedAt: new Date(),
    completedAt: new Date(),
  };

  if (isRunning) {
    logger.debug('Notification reconciliation already running, skipping...');
    return emptyStats;
  }

  isRunning = true;
  const stats: ReconciliationStats = { ...emptyStats };

  try {
    logger.debug('Notification reconciliation job started');

    const cutoff = new Date(Date.now() - STALE_MS);

    await resolveStuckNotifications(cutoff, stats);
    await refundFailedUnrefundedNotifications(cutoff, stats);

    stats.completedAt = new Date();

    logger.info(
      {
        staleResolved: stats.staleResolved,
        refunded: stats.refunded,
        refundedAmount: stats.refundedAmount,
        errors: stats.errors,
        duration: `${stats.completedAt.getTime() - stats.startedAt.getTime()}ms`,
      },
      'Notification reconciliation job completed'
    );

    return stats;
  } catch (error) {
    logger.error({ error }, 'Notification reconciliation job failed');
    throw error;
  } finally {
    isRunning = false;
  }
}

export async function runNotificationReconciliationManually(): Promise<ReconciliationStats> {
  logger.info('Manual notification reconciliation triggered');
  return runNotificationReconciliation();
}

/**
 * Payment Reconciliation Job
 * Runs periodically to check PENDING payments against payment service
 * and updates status/processes them if successful
 */

import { CronJob } from 'cron';
import { logger } from '../config/logger';
import { PaymentTrackingService } from '../services/payment-tracking.service';
import { getPaymentClient } from '../utils/payment-client';

interface ReconciliationStats {
  totalChecked: number;
  successfullyProcessed: number;
  failed: number;
  errors: Array<{ ref: string; error: string }>;
  startedAt: Date;
  completedAt: Date;
}

let paymentReconciliationJob: CronJob | null = null;
let isRunning = false;

/**
 * Initialize the payment reconciliation cron job
 * Runs every 5 minutes to reconcile pending payments
 * Cron: every 5 minutes pattern
 */
export function initializePaymentReconciliationJob(): void {
  const cronSchedule = '0 */5 * * * *';

  paymentReconciliationJob = new CronJob(
    cronSchedule,
    async () => {
      try {
        await runPaymentReconciliation();
      } catch (error) {
        logger.error({ error }, 'Payment reconciliation job failed');
      }
    },
    null, // onComplete
    true, // start immediately
    'UTC' // timezone
  );

  logger.info({ schedule: cronSchedule }, 'Payment reconciliation job initialized');
}

/**
 * Stop the payment reconciliation job
 */
export function stopPaymentReconciliationJob(): void {
  if (paymentReconciliationJob) {
    paymentReconciliationJob.stop();
    paymentReconciliationJob = null;
    logger.info('Payment reconciliation job stopped');
  }
}

/**
 * Run payment reconciliation (called by cron or manually)
 */
export async function runPaymentReconciliation(): Promise<ReconciliationStats> {
  if (isRunning) {
    logger.debug('Payment reconciliation already running, skipping...');
    return {
      totalChecked: 0,
      successfullyProcessed: 0,
      failed: 0,
      errors: [],
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  isRunning = true;
  const stats: ReconciliationStats = {
    totalChecked: 0,
    successfullyProcessed: 0,
    failed: 0,
    errors: [],
    startedAt: new Date(),
    completedAt: new Date(),
  };

  try {
    logger.debug('Payment reconciliation job started');

    // Get all pending payments
    const pendingPayments = await PaymentTrackingService.getPendingPayments('*');

    if (!pendingPayments || pendingPayments.length === 0) {
      logger.debug('No pending payments found');
      stats.completedAt = new Date();
      return stats;
    }

    logger.info({ count: pendingPayments.length }, 'Found pending payments to reconcile');

    const paymentClient = getPaymentClient();

    // Process each pending payment
    for (const payment of pendingPayments) {
      stats.totalChecked++;

      try {
        const status = await paymentClient.getPaymentStatus(payment.ref);

        logger.debug({ ref: payment.ref, status: status.status }, 'Checked payment status');

        if (status.status === 'SUCCESSFUL') {
          await processSuccessfulPayment(payment, status);
          stats.successfullyProcessed++;
        } else if (status.status === 'FAILED') {
          await PaymentTrackingService.markPaymentFailed(payment.ref, `Payment failed: ${status.status}`);
          logger.warn({ ref: payment.ref }, 'Marked payment as failed');
          stats.failed++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ ref: payment.ref, error: errorMsg }, 'Failed to reconcile payment');
        stats.errors.push({
          ref: payment.ref,
          error: errorMsg,
        });
      }
    }

    stats.completedAt = new Date();

    logger.info(
      {
        totalChecked: stats.totalChecked,
        successfullyProcessed: stats.successfullyProcessed,
        failed: stats.failed,
        errors: stats.errors.length,
        duration: `${stats.completedAt.getTime() - stats.startedAt.getTime()}ms`,
      },
      'Payment reconciliation job completed'
    );

    return stats;
  } catch (error) {
    logger.error({ error }, 'Payment reconciliation job failed');
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Process a successful payment
 */
async function processSuccessfulPayment(
  payment: any,
  status: { transaction_id: string; status: string; amount: number }
): Promise<void> {
  const { PaygService } = await import('../services/payg.service');
  const { SubscriptionService } = await import('../services/subscription.service');
  const { marketplaceService } = await import('../services/marketplace.service');

  const confirmPaymentData: any = {
    status: 'SUCCESSFUL',
    transactionId: status.transaction_id,
    processedAt: new Date(),
  };

  try {
    const paymentType: string = payment.type;

    if (paymentType === 'template_purchase') {
      if (!payment.templateId || !payment.appId) {
        throw new Error('Template or app information missing');
      }

      await marketplaceService.installTemplate(payment.templateId, payment.appId, payment.accountId, {});
      confirmPaymentData.appTemplateId = payment.templateId;

      logger.info(
        { accountId: payment.accountId, ref: payment.ref, templateId: payment.templateId },
        'Template installed via reconciliation job'
      );
    } else if (paymentType === 'subscription') {
      if (!payment.planId) {
        throw new Error('Plan information missing');
      }

      await SubscriptionService.changePlan(payment.accountId, payment.planId);
      confirmPaymentData.subscriptionId = payment.planId;

      logger.info(
        { accountId: payment.accountId, ref: payment.ref, planId: payment.planId },
        'Subscription activated via reconciliation job'
      );
    } else {
      // PAYGO top-up
      const paygResult = await PaygService.creditFromPayment({
        accountId: payment.accountId,
        amountCents: status.amount,
        paymentRef: payment.ref,
      });

      confirmPaymentData.creditTransactionId = paygResult.transaction.id;
      confirmPaymentData.newBalance = Math.round(paygResult.newBalance * 100);
      confirmPaymentData.bonusAmount = Math.round((paygResult.bonusAmount || 0) * 100);
      confirmPaymentData.bonusPercent = paygResult.bonusPercent;
      confirmPaymentData.transactionType = 'topup';

      logger.info(
        {
          accountId: payment.accountId,
          ref: payment.ref,
          newBalance: paygResult.newBalance,
          creditTransactionId: paygResult.transaction.id,
        },
        'PAYG balance credited via reconciliation job'
      );
    }

    await PaymentTrackingService.confirmPayment(payment.ref, confirmPaymentData);

    logger.info(
      { accountId: payment.accountId, ref: payment.ref, type: paymentType },
      'Payment confirmed and processed via reconciliation job'
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ ref: payment.ref, error: errorMsg }, 'Failed to process successful payment');
    throw error;
  }
}

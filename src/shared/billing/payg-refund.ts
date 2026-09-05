import { Prisma } from '@prisma/client';
import { prismaRead, prismaWrite } from '../database';

export interface RefundResult {
  refunded: boolean;
  amount: number;
  newBalance: number | null;
}

export async function refundFailedNotification(notificationId: string, reason: string): Promise<RefundResult> {
  if (!notificationId) {
    return { refunded: false, amount: 0, newBalance: null };
  }

  const deduction = await prismaRead.creditTransaction.findFirst({
    where: { notification_id: notificationId, type: 'deduction' },
  });

  if (!deduction) {
    return { refunded: false, amount: 0, newBalance: null };
  }

  const existingRefund = await prismaRead.creditTransaction.findFirst({
    where: { notification_id: notificationId, type: 'refund' },
  });

  if (existingRefund) {
    return { refunded: false, amount: 0, newBalance: null };
  }

  const amount = Math.abs(deduction.amount);

  const balance = await prismaWrite.creditBalance.findUnique({
    where: { id: deduction.credit_balance_id },
  });

  if (!balance) {
    return { refunded: false, amount: 0, newBalance: null };
  }

  try {
    const newBalance = await prismaWrite.$transaction(async (tx) => {
      const updatedBalance = parseFloat((balance.balance + amount).toFixed(6));

      await tx.creditBalance.update({
        where: { id: balance.id },
        data: { balance: updatedBalance, updated_at: new Date() },
      });

      await tx.creditTransaction.create({
        data: {
          account_id: deduction.account_id,
          credit_balance_id: balance.id,
          type: 'refund',
          status: 'COMPLETED',
          amount,
          balance_after: updatedBalance,
          description: reason,
          channel: deduction.channel,
          notification_id: notificationId,
        },
      });

      await tx.notification.updateMany({
        where: { id: notificationId },
        data: { refundedAt: new Date() },
      });

      return updatedBalance;
    });

    return { refunded: true, amount, newBalance };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { refunded: false, amount: 0, newBalance: null };
    }
    throw error;
  }
}

import { logger } from '../config/logger';
import { PaymentRepository, CreatePaymentData, UpdatePaymentData } from '../repositories/payment.repository';
import type { PaymentType, PaymentStatus } from '@prisma/client';

export class PaymentTrackingService {
  /**
   * Record a new payment initialization
   * Called when payment is initiated via /payments/initialize
   */
  static async recordPaymentInitialization(data: CreatePaymentData) {
    try {
      const payment = await PaymentRepository.create(data);

      logger.info(
        {
          paymentId: payment.id,
          accountId: payment.accountId,
          ref: payment.ref,
          type: payment.type,
          amount: payment.amount,
        },
        'Payment initialization recorded'
      );

      return payment;
    } catch (error) {
      logger.error(
        {
          error,
          ref: data.ref,
          accountId: data.accountId,
        },
        'Failed to record payment initialization'
      );
      throw error;
    }
  }

  /**
   * Get payment by reference
   */
  static async getPaymentByRef(ref: string) {
    return PaymentRepository.findByRef(ref);
  }

  /**
   * Get payment by ID
   */
  static async getPaymentById(id: string) {
    return PaymentRepository.findById(id);
  }

  /**
   * Confirm payment and update status
   * Called when payment is confirmed via /payments/confirm/:ref
   */
  static async confirmPayment(ref: string, updateData: UpdatePaymentData) {
    try {
      const payment = await PaymentRepository.findByRef(ref);

      if (!payment) {
        throw new Error(`Payment not found: ${ref}`);
      }

      if (payment.status === 'SUCCESSFUL') {
        throw new Error('Payment already processed');
      }

      const updated = await PaymentRepository.update(ref, {
        status: 'SUCCESSFUL',
        processedAt: new Date(),
        ...updateData,
      });

      logger.info(
        {
          paymentId: updated.id,
          ref: updated.ref,
          type: updated.type,
          status: updated.status,
        },
        'Payment confirmed and processed'
      );

      return updated;
    } catch (error) {
      logger.error(
        {
          error,
          ref,
        },
        'Failed to confirm payment'
      );
      throw error;
    }
  }

  /**
   * Mark payment as failed
   */
  static async markPaymentFailed(ref: string, failureReason: string) {
    try {
      const payment = await PaymentRepository.update(ref, {
        status: 'FAILED',
        failureReason,
        processedAt: new Date(),
      });

      logger.warn(
        {
          ref,
          failureReason,
        },
        'Payment marked as failed'
      );

      return payment;
    } catch (error) {
      logger.error(
        {
          error,
          ref,
        },
        'Failed to mark payment as failed'
      );
      throw error;
    }
  }

  /**
   * Get payment history for an account
   */
  static async getPaymentHistory(accountId: string, limit = 50, offset = 0) {
    return PaymentRepository.getPaymentHistory(accountId, limit, offset);
  }

  /**
   * Get pending payments for an account
   */
  static async getPendingPayments(accountId: string) {
    return PaymentRepository.getPaymentsByStatus(accountId, 'PENDING');
  }

  /**
   * Get successful payments by type
   */
  static async getSuccessfulPaymentsByType(accountId: string, type: PaymentType) {
    return PaymentRepository.getPaymentsByStatus(accountId, 'SUCCESSFUL');
  }

  /**
   * Calculate total amount for a payment type and status
   */
  static async getTotalByTypeAndStatus(accountId: string, type: PaymentType, status: PaymentStatus) {
    const total = await PaymentRepository.sumByType(accountId, type, status);
    return total;
  }
}

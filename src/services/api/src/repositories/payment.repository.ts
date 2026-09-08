import { prismaRead, prismaWrite } from '@shared/database';
import type { PaymentType, TransactionType, PaymentStatus, Currency } from '@prisma/client';

export interface CreatePaymentData {
  accountId: string;
  ref: string;
  orderId: string;
  method?: string;
  amount: number;
  currency?: Currency;
  type: PaymentType;
  transactionType?: TransactionType;
  templateId?: string;
  appId?: string;
  planId?: string;
  email?: string;
  phoneNumber?: string;
  customerName?: string;
  initiatedAt?: Date;
  transactionId?: string;
  provider?: string;
  exchangeRate?: number;
  baseCode?: string;
  targetCode?: string;
  amountLocal?: number;
}

export interface UpdatePaymentData {
  status?: PaymentStatus;
  transactionId?: string;
  transactionType?: TransactionType;
  creditTransactionId?: string;
  subscriptionId?: string;
  appTemplateId?: string;
  processedAt?: Date;
  failureReason?: string;
  newBalance?: number;
  bonusAmount?: number;
  bonusPercent?: number;
  provider?: string;
  exchangeRate?: number;
  baseCode?: string;
  targetCode?: string;
  amountLocal?: number;
}

export class PaymentRepository {
  static async create(data: CreatePaymentData) {
    return prismaWrite.payment.create({
      data: {
        accountId: data.accountId,
        ref: data.ref,
        orderId: data.orderId,
        method: data.method,
        amount: data.amount,
        currency: data.currency || 'USD',
        type: data.type,
        transactionType: data.transactionType,
        status: 'PENDING',
        initiatedAt: data.initiatedAt || new Date(),
        templateId: data.templateId,
        appId: data.appId,
        planId: data.planId,
        email: data.email,
        phoneNumber: data.phoneNumber,
        customerName: data.customerName,
        transactionId: data.transactionId,
        provider: data.provider,
        exchangeRate: data.exchangeRate,
        baseCode: data.baseCode,
        targetCode: data.targetCode,
        amountLocal: data.amountLocal,
      },
    });
  }

  static async findByRef(ref: string) {
    return prismaRead.payment.findUnique({
      where: { ref },
    });
  }

  static async findById(id: string) {
    return prismaRead.payment.findUnique({
      where: { id },
    });
  }

  static async findByAccountAndRef(accountId: string, ref: string) {
    return prismaRead.payment.findFirst({
      where: {
        accountId,
        ref,
      },
    });
  }

  static async update(ref: string, data: UpdatePaymentData) {
    return prismaWrite.payment.update({
      where: { ref },
      data,
    });
  }

  static async getPaymentHistory(accountId: string, limit = 50, offset = 0) {
    const [payments, total] = await Promise.all([
      prismaRead.payment.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prismaRead.payment.count({
        where: { accountId },
      }),
    ]);

    return {
      payments,
      total,
      limit,
      offset,
    };
  }

  static async getPaymentsByStatus(accountId: string, status: PaymentStatus) {
    return prismaRead.payment.findMany({
      where: {
        accountId,
        status,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPaymentsByType(accountId: string, type: PaymentType) {
    return prismaRead.payment.findMany({
      where: {
        accountId,
        type,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async sumByType(accountId: string, type: PaymentType, status: PaymentStatus) {
    const result = await prismaRead.payment.aggregate({
      where: {
        accountId,
        type,
        status,
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount || 0;
  }

  static async getAllPendingPayments() {
    return prismaRead.payment.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

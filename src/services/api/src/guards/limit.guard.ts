import { FastifyRequest, FastifyReply } from 'fastify';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils';
import { metrics } from '../plugins/metrics';
import { accountLimitsNotification } from '../services/account-limits-notification.service';
import { prismaRead } from '@shared/database';

async function notifyAccountApproachingLimit(
  accountId: string,
  limitType: string,
  currentUsage: number,
  limit: number,
  usagePercent: number
): Promise<void> {
  try {
    const account = await prismaRead.account.findUnique({
      where: { id: accountId },
    });
    if (!account) return;

    const owner = await prismaRead.user.findUnique({
      where: { id: account.owner_user_id },
      select: { email: true, firstName: true },
    });

    if (owner?.email) {
      await accountLimitsNotification.checkAndNotify(
        { accountId, limitType, currentUsage, limit, usagePercent, status: 'approaching' },
        owner.email,
        owner.firstName || 'Your Account'
      );
    }
  } catch {
    // Silently fail - notifications are best effort
  }
}

async function notifyAccountLimitExceeded(
  accountId: string,
  limitType: string,
  currentUsage: number,
  limit: number
): Promise<void> {
  try {
    const account = await prismaRead.account.findUnique({
      where: { id: accountId },
    });
    if (!account) return;

    const owner = await prismaRead.user.findUnique({
      where: { id: account.owner_user_id },
      select: { email: true, firstName: true },
    });

    if (owner?.email) {
      await accountLimitsNotification.checkAndNotify(
        { accountId, limitType, currentUsage, limit, usagePercent: 100, status: 'exceeded' },
        owner.email,
        owner.firstName || 'Your Account'
      );
    }
  } catch {
    // Silently fail - notifications are best effort
  }
}

export async function preSendLimitGuard(request: FastifyRequest, reply: FastifyReply) {
  const accountId = request.headers['x-account-id'] as string;
  if (!accountId) return;

  // PAYG accounts are billed by credit deduction (handled in the controller).
  // Their plan limits are all -1 (unlimited), so skip the subscription quota check.
  const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);
  if (isPayg) return;

  const body = request.body as { channel?: string } | undefined;
  const channel = body?.channel?.toLowerCase() || 'email';
  const metric = `${channel}s_per_month`;

  const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, metric);

  if (!result.allowed) {
    metrics.usageLimitExceeded.inc({ metric, account: accountId });

    // metric name is the correct limitType (e.g. "emails_per_month")
    notifyAccountLimitExceeded(accountId, metric, result.limit, result.limit).catch(() => {});

    return ApiResponseHelper.error(
      reply,
      `Usage limit exceeded for ${channel}. Limit: ${result.limit}, Remaining: ${result.remaining}. Please upgrade your plan.`,
      4029,
      429
    );
  }

  if (result.remaining !== -1 && result.remaining < 10) {
    reply.header('X-Usage-Warning', `Approaching limit: ${result.remaining} ${channel}s remaining`);

    const usagePercent = ((result.limit - result.remaining) / result.limit) * 100;
    notifyAccountApproachingLimit(
      accountId,
      metric, // correct metric name, not raw channel string
      result.limit - result.remaining,
      result.limit,
      usagePercent
    ).catch(() => {});
  }
}

export async function preBulkLimitGuard(request: FastifyRequest, reply: FastifyReply) {
  const accountId = (request as any).user?.account_ids?.[0];
  const body = request.body as { notifications?: Array<{ channel?: string }> } | undefined;

  if (!accountId || !body?.notifications?.length) {
    return;
  }

  // PAYG accounts are billed by credit deduction in the controller — skip quota check.
  const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);
  if (isPayg) return;

  const channel = body.notifications[0]?.channel?.toLowerCase() || 'email';
  const metric = `${channel}s_per_month`;
  const quantity = body.notifications.length;

  const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, metric);

  if (!result.allowed) {
    metrics.usageLimitExceeded.inc({ metric, account: accountId });

    return ApiResponseHelper.error(
      reply,
      `Usage limit exceeded for ${channel}. Cannot send ${quantity} notifications. Limit: ${result.limit}, Remaining: ${result.remaining}`,
      4029,
      429
    );
  }

  if (result.remaining !== -1 && result.remaining < quantity) {
    return ApiResponseHelper.error(
      reply,
      `Insufficient quota. Requested: ${quantity}, Remaining: ${result.remaining}. Please reduce batch size or upgrade your plan.`,
      4029,
      429
    );
  }
}

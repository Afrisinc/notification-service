import { prismaRead } from '@shared/database';
import { logger } from '../config/logger';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import type { PaygChannel } from '../types/payg.types';

export interface ChannelEligibilityResult {
  eligible: boolean;
  reason?: string;
  errorCode?: number;
  statusCode?: number;
}

const RESTRICTED_PLANS = new Set(['Free', 'Trial', 'Free Trial']);
const FREE_CHANNELS = new Set(['EMAIL']);
const PAID_CHANNELS = new Set(['SMS', 'PUSH', 'IN_APP', 'WHATSAPP']);

async function getPlanName(accountId: string): Promise<string | null> {
  const subscription = await prismaRead.subscription.findFirst({
    where: { account_id: accountId },
    select: {
      plan: { select: { name: true } },
    },
  });
  return subscription?.plan?.name ?? null;
}

export async function validateChannelEligibility(
  accountId: string,
  channel: PaygChannel
): Promise<ChannelEligibilityResult> {
  const normalizedChannel = channel.toUpperCase();

  try {
    if (FREE_CHANNELS.has(normalizedChannel)) {
      logger.debug({ accountId, channel: normalizedChannel }, 'Channel is free for all plans');
      return { eligible: true };
    }

    if (!PAID_CHANNELS.has(normalizedChannel)) {
      logger.warn({ accountId, channel: normalizedChannel }, 'Unknown channel type');
      return {
        eligible: false,
        reason: `Unsupported channel: ${channel}`,
        errorCode: 4000,
        statusCode: 400,
      };
    }

    const isPayg = await PlanEnforcementMiddleware.isPaygAccount(accountId);

    if (isPayg) {
      logger.debug(
        { accountId, channel: normalizedChannel },
        'Channel eligible: PAYG account (balance check deferred to quantity-based validation)'
      );
      return { eligible: true };
    }

    const planName = await getPlanName(accountId);

    if (!planName) {
      logger.error({ accountId, channel: normalizedChannel }, 'Eligibility check failed: account has no active plan');
      return {
        eligible: false,
        reason: 'Account has no active subscription plan.',
        errorCode: 4032,
        statusCode: 400,
      };
    }

    const isRestrictedPlan = Array.from(RESTRICTED_PLANS).some((plan) =>
      planName.toLowerCase().includes(plan.toLowerCase())
    );

    if (isRestrictedPlan) {
      logger.warn(
        { accountId, planName, channel: normalizedChannel },
        `${normalizedChannel} blocked: plan "${planName}" does not support paid channels`
      );
      return {
        eligible: false,
        reason: `${normalizedChannel} is not available on the "${planName}" plan. Upgrade your plan to send notifications via ${normalizedChannel}.`,
        errorCode: 4033,
        statusCode: 403,
      };
    }

    logger.debug(
      { accountId, planName, channel: normalizedChannel },
      'Channel eligible: subscription plan supports this channel'
    );
    return { eligible: true };
  } catch (error) {
    logger.error({ error, accountId, channel: normalizedChannel }, 'Channel eligibility validation failed with error');
    return {
      eligible: false,
      reason: 'Unable to validate channel eligibility. Please try again.',
      errorCode: 5000,
      statusCode: 500,
    };
  }
}

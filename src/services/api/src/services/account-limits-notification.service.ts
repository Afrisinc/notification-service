import pino from 'pino';
import { getConfig } from '@shared/config';
import { prismaRead, prismaWrite } from '@shared/database';
import { NotifyService } from './notify.service';

const logger = pino({ level: 'info' });

export interface LimitCheckResult {
  accountId: string;
  limitType: string; // metric name e.g. 'emails_per_month'
  currentUsage: number;
  limit: number;
  usagePercent: number;
  status: 'ok' | 'approaching' | 'exceeded';
}

/** Hours between repeated alerts for the same account + metric + status */
const THROTTLE_HOURS = 24;

class AccountLimitsNotificationService {
  private approachingTemplateId: string | null = null;
  private exceededTemplateId: string | null = null;
  private systemAccountId: string | null = null;
  private systemAppId: string | null = null;
  private initialized = false;
  private readonly notifyService: NotifyService;

  constructor() {
    this.notifyService = new NotifyService();
  }

  private initialize(): void {
    if (this.initialized) return;
    try {
      const config = getConfig();
      this.approachingTemplateId = config.USAGE_APPROACHING_LIMIT_TEMPLATE_ID || null;
      this.exceededTemplateId = config.USAGE_LIMIT_EXCEEDED_TEMPLATE_ID || null;
      this.systemAccountId = config.SYSTEM_ACCOUNT_ID || null;
      this.systemAppId = config.SYSTEM_APP_ID || null;
      this.initialized = true;

      if (!this.approachingTemplateId || !this.exceededTemplateId) {
        logger.warn(
          'Limit notification templates not configured — set USAGE_APPROACHING_LIMIT_TEMPLATE_ID and USAGE_LIMIT_EXCEEDED_TEMPLATE_ID'
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize account limits notification service');
      this.initialized = true;
    }
  }

  /**
   * DB-backed throttle: returns true if a notification of this type was already
   * sent for this account within the last THROTTLE_HOURS hours.
   * Survives process restarts — no in-memory state.
   */
  private async shouldThrottle(accountId: string, limitType: string, status: string): Promise<boolean> {
    try {
      const since = new Date(Date.now() - THROTTLE_HOURS * 60 * 60 * 1000);
      const recent = await prismaRead.limitNotificationLog.findFirst({
        where: {
          account_id: accountId,
          limit_type: limitType,
          status,
          sent_at: { gte: since },
        },
      });
      return !!recent;
    } catch {
      return false; // fail open for alerting
    }
  }

  private async recordNotificationSent(accountId: string, limitType: string, status: string): Promise<void> {
    try {
      await prismaWrite.limitNotificationLog.create({
        data: { account_id: accountId, limit_type: limitType, status },
      });
    } catch (error) {
      logger.error({ error, accountId, limitType, status }, 'Failed to record limit notification log');
    }
  }

  async checkAndNotify(result: LimitCheckResult, accountEmail: string, accountName: string): Promise<void> {
    this.initialize();

    if (result.status === 'ok') return;

    const throttled = await this.shouldThrottle(result.accountId, result.limitType, result.status);
    if (throttled) {
      logger.debug({ accountId: result.accountId, limitType: result.limitType }, 'Limit notification throttled');
      return;
    }

    if (result.status === 'approaching') {
      await this.sendApproachingLimitEmail(result, accountEmail, accountName);
    } else if (result.status === 'exceeded') {
      await this.sendLimitExceededEmail(result, accountEmail, accountName);
    }

    await this.recordNotificationSent(result.accountId, result.limitType, result.status);
  }

  private async sendApproachingLimitEmail(
    result: LimitCheckResult,
    accountEmail: string,
    accountName: string
  ): Promise<void> {
    if (!this.systemAccountId || !this.systemAppId || !this.approachingTemplateId) {
      logger.warn('System account or approaching-limit template not configured — skipping alert email');
      return;
    }
    try {
      await this.notifyService.sendNotification(this.systemAccountId, this.systemAppId, {
        channel: 'EMAIL',
        recipient: accountEmail,
        templateId: this.approachingTemplateId,
        app_id: this.systemAppId,
        payload: {
          accountName,
          limitType: this.formatLimitType(result.limitType),
          currentUsage: result.currentUsage.toLocaleString(),
          limit: result.limit.toLocaleString(),
          usagePercent: Math.round(result.usagePercent),
        },
        priority: 'HIGH',
      });
      logger.info(
        { accountId: result.accountId, limitType: result.limitType, usagePercent: result.usagePercent },
        'Approaching limit notification sent'
      );
    } catch (error) {
      logger.error({ error, accountId: result.accountId }, 'Failed to send approaching limit email');
    }
  }

  private async sendLimitExceededEmail(
    result: LimitCheckResult,
    accountEmail: string,
    accountName: string
  ): Promise<void> {
    if (!this.systemAccountId || !this.systemAppId || !this.exceededTemplateId) {
      logger.warn('System account or exceeded-limit template not configured — skipping alert email');
      return;
    }
    const overage = result.currentUsage - result.limit;
    const resetDate = this.getNextResetDate();
    try {
      await this.notifyService.sendNotification(this.systemAccountId, this.systemAppId, {
        channel: 'EMAIL',
        recipient: accountEmail,
        templateId: this.exceededTemplateId,
        app_id: this.systemAppId,
        payload: {
          accountName,
          limitType: this.formatLimitType(result.limitType),
          currentUsage: result.currentUsage.toLocaleString(),
          limit: result.limit.toLocaleString(),
          overage: overage.toLocaleString(),
          resetDate,
        },
        priority: 'URGENT',
      });
      logger.info(
        { accountId: result.accountId, limitType: result.limitType, overage },
        'Limit exceeded notification sent'
      );
    } catch (error) {
      logger.error({ error, accountId: result.accountId }, 'Failed to send limit exceeded email');
    }
  }

  private formatLimitType(metric: string): string {
    const labels: Record<string, string> = {
      emails_per_month: 'Email',
      sms_per_month: 'SMS',
      in_app_per_month: 'In-App',
      push_subscribers: 'Push Subscribers',
      contacts: 'Contacts',
      api_calls: 'API Calls',
    };
    return labels[metric] ?? metric.replace(/_/g, ' ');
  }

  private getNextResetDate(): string {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
}

export const accountLimitsNotification = new AccountLimitsNotificationService();

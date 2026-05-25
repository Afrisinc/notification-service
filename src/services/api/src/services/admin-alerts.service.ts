import pino from 'pino';
import { AlertType, AlertSeverity } from '@prisma/client';
import { getConfig } from '@shared/config';
import { NotifyService } from './notify.service';
import { systemAlertRepository } from '../repositories/system-alert.repository';

export { AlertType, AlertSeverity };

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface ThrottleState {
  lastSent: number;
  count: number;
}

const throttleMap = new Map<string, ThrottleState>();
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const MAX_ALERTS_PER_WINDOW = 3;

const logger = pino({ level: 'info' });

class AdminAlertsService {
  private adminEmails: string[] = [];
  private systemAccountId: string | null = null;
  private systemAppId: string | null = null;
  private alertTemplateId: string | null = null;
  private webhookUrl: string | null = null;
  private initialized = false;
  private readonly notifyService: NotifyService;

  constructor() {
    this.notifyService = new NotifyService();
  }

  initialize(): void {
    if (this.initialized) return;

    try {
      const config = getConfig();
      const emailsStr = config.ADMIN_EMAILS || '';
      this.adminEmails = emailsStr
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      this.systemAccountId = config.SYSTEM_ACCOUNT_ID || null;
      this.systemAppId = config.SYSTEM_APP_ID || null;
      this.alertTemplateId = config.SYSTEM_ALERT_TEMPLATE_ID || null;
      this.webhookUrl = config.ALERT_WEBHOOK_URL || null;
      this.initialized = true;

      if (this.adminEmails.length === 0) {
        logger.warn('ADMIN_EMAILS not configured - system alerts will only be logged');
      } else {
        logger.info({ count: this.adminEmails.length }, 'Admin alerts service initialized');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize admin alerts');
      this.initialized = true;
    }
  }

  private shouldThrottle(key: string): boolean {
    const now = Date.now();
    const state = throttleMap.get(key);

    if (!state || now - state.lastSent > THROTTLE_WINDOW_MS) {
      throttleMap.set(key, { lastSent: now, count: 1 });
      return false;
    }

    if (state.count >= MAX_ALERTS_PER_WINDOW) {
      return true;
    }

    state.count++;
    return false;
  }

  async sendAlert(alert: AlertPayload): Promise<void> {
    this.initialize();

    const throttleKey = `${alert.type}:${alert.metadata?.provider || 'system'}`;
    if (this.shouldThrottle(throttleKey)) {
      logger.debug({ throttleKey }, 'Alert throttled');
      return;
    }

    // Store alert in database
    try {
      await systemAlertRepository.create({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to store alert in database');
    }

    // Log the alert
    logger.warn(
      {
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
        metadata: alert.metadata,
      },
      `SYSTEM ALERT: ${alert.message}`
    );

    // Send webhook if configured
    if (this.webhookUrl) {
      this.sendWebhook(alert).catch((err) => {
        logger.error({ error: err }, 'Webhook alert failed');
      });
    }

    // Send email notifications to admins
    if (this.adminEmails.length > 0 && this.systemAccountId && this.systemAppId && this.alertTemplateId) {
      await this.sendAdminEmails(alert);
    }
  }

  private async sendWebhook(alert: AlertPayload): Promise<void> {
    if (!this.webhookUrl) return;

    const colors: Record<AlertSeverity, string> = {
      [AlertSeverity.INFO]: '#0066ff',
      [AlertSeverity.WARNING]: '#ffcc00',
      [AlertSeverity.ERROR]: '#ff6600',
      [AlertSeverity.CRITICAL]: '#ff0000',
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity}] ${alert.title}`,
        attachments: [
          {
            color: colors[alert.severity],
            title: alert.title,
            text: alert.message,
            fields: Object.entries(alert.metadata || {}).map(([k, v]) => ({
              title: k,
              value: String(v),
              short: true,
            })),
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });
  }

  private async sendAdminEmails(alert: AlertPayload): Promise<void> {
    if (!this.systemAccountId || !this.systemAppId || !this.alertTemplateId) return;

    const priority = alert.severity === AlertSeverity.CRITICAL ? 'URGENT' : 'HIGH';
    const timestamp = new Date().toISOString();

    for (const email of this.adminEmails) {
      try {
        await this.notifyService.sendNotification(this.systemAccountId, this.systemAppId, {
          channel: 'EMAIL',
          recipient: email,
          templateId: this.alertTemplateId,
          app_id: this.systemAppId,
          payload: {
            alertType: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            timestamp,
            ...alert.metadata,
          },
          priority,
        });
      } catch (error) {
        logger.error({ email, error }, 'Failed to send admin alert email');
      }
    }

    logger.info({ count: this.adminEmails.length }, 'Admin alert emails sent');
  }

  async circuitBreakerOpen(provider: string, failures: number): Promise<void> {
    await this.sendAlert({
      type: AlertType.CIRCUIT_BREAKER_OPEN,
      severity: AlertSeverity.ERROR,
      title: `Circuit Breaker OPEN: ${provider}`,
      message: `Provider ${provider} circuit breaker opened after ${failures} consecutive failures.`,
      metadata: { provider, failures },
    });
  }

  async circuitBreakerRecovered(provider: string): Promise<void> {
    await this.sendAlert({
      type: AlertType.CIRCUIT_BREAKER_RECOVERED,
      severity: AlertSeverity.INFO,
      title: `Circuit Breaker Recovered: ${provider}`,
      message: `Provider ${provider} has recovered and is now accepting requests.`,
      metadata: { provider },
    });
  }

  async dlqThresholdExceeded(queue: string, count: number, threshold: number): Promise<void> {
    await this.sendAlert({
      type: AlertType.DLQ_THRESHOLD_EXCEEDED,
      severity: AlertSeverity.WARNING,
      title: `DLQ Alert: ${queue}`,
      message: `Dead letter queue ${queue} has ${count} messages (threshold: ${threshold}).`,
      metadata: { queue, count, threshold },
    });
  }

  async providerFailure(provider: string, error: string, consecutiveFailures: number): Promise<void> {
    const severity = consecutiveFailures >= 5 ? AlertSeverity.CRITICAL : AlertSeverity.ERROR;
    await this.sendAlert({
      type: AlertType.PROVIDER_FAILURE,
      severity,
      title: `Provider Failure: ${provider}`,
      message: `${provider} failed: ${error}. Consecutive failures: ${consecutiveFailures}`,
      metadata: { provider, error, consecutiveFailures },
    });
  }

  async emailProviderUnhealthy(provider: string, error: string): Promise<void> {
    await this.sendAlert({
      type: AlertType.EMAIL_PROVIDER_UNHEALTHY,
      severity: AlertSeverity.CRITICAL,
      title: `Email Provider Unhealthy: ${provider}`,
      message: `Health check failed for ${provider}: ${error}. Email delivery may be impacted.`,
      metadata: { provider, error },
    });
  }

  async highErrorRate(channel: string, errorRate: number, threshold: number): Promise<void> {
    await this.sendAlert({
      type: AlertType.HIGH_ERROR_RATE,
      severity: AlertSeverity.ERROR,
      title: `High Error Rate: ${channel}`,
      message: `${channel} has ${errorRate.toFixed(1)}% error rate (threshold: ${threshold}%)`,
      metadata: { channel, errorRate, threshold },
    });
  }

  async rateLimitAbuse(accountId: string, endpoint: string, hits: number): Promise<void> {
    await this.sendAlert({
      type: AlertType.RATE_LIMIT_ABUSE,
      severity: AlertSeverity.WARNING,
      title: 'Rate Limit Abuse',
      message: `Account ${accountId} hit rate limits ${hits} times on ${endpoint}`,
      metadata: { accountId, endpoint, hits },
    });
  }
}

export const adminAlerts = new AdminAlertsService();

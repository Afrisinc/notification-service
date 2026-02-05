import pino from 'pino';
import { EmailNotification } from '@afrisinc-notify/common';
import { db } from '@afrisinc-notify/db';
import { getConfig } from '@afrisinc-notify/config';
import { SMTPProvider } from './providers/smtp';
import { SendGridProvider } from './providers/sendgrid';

export class EmailProcessor {
  private smtpProvider?: SMTPProvider;
  private sendgridProvider?: SendGridProvider;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    // Initialize providers based on config
    if (config.EMAIL_PROVIDER === 'smtp') {
      this.smtpProvider = new SMTPProvider(logger);
    } else if (config.EMAIL_PROVIDER === 'sendgrid') {
      this.sendgridProvider = new SendGridProvider(logger);
    }
  }

  async process(email: EmailNotification): Promise<void> {
    try {
      this.logger.info(
        { emailId: email.id, to: email.to },
        'Processing email notification'
      );

      // Select provider
      let result;
      const config = getConfig();

      if (config.EMAIL_PROVIDER === 'sendgrid' && this.sendgridProvider) {
        result = await this.sendgridProvider.send(email);
      } else if (this.smtpProvider) {
        result = await this.smtpProvider.send(email);
      } else {
        throw new Error('No email provider configured');
      }

      // Update notification status to sent
      await db.notification.update({
        where: { id: email.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          externalId: result.messageId,
        },
      });

      this.logger.info(
        { emailId: email.id, messageId: result.messageId },
        'Email sent successfully'
      );
    } catch (error) {
      this.logger.error(
        { error, emailId: email.id },
        'Failed to process email'
      );

      // Update notification status to failed
      try {
        await db.notification.update({
          where: { id: email.id },
          data: {
            status: 'failed',
            failedAt: new Date(),
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (updateError) {
        this.logger.error(updateError, 'Failed to update notification status');
      }

      throw error;
    }
  }
}

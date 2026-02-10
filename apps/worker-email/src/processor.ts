import pino from "pino";
import { db } from "@afrisinc-notify/db";
import { getConfig } from "@afrisinc-notify/config";
import { SMTPProvider } from "./providers/smtp";
import { SendGridProvider } from "./providers/sendgrid";

export class EmailProcessor {
  private smtpProvider?: SMTPProvider;
  private sendgridProvider?: SendGridProvider;

  constructor(private logger: pino.Logger) {
    const config = getConfig();

    // Initialize providers based on config
    if (config.EMAIL_PROVIDER === "smtp") {
      this.smtpProvider = new SMTPProvider(logger);
    } else if (config.EMAIL_PROVIDER === "sendgrid") {
      this.sendgridProvider = new SendGridProvider(logger);
    }
  }

  async process(email: any): Promise<void> {
    try {
      // Map incoming message format to EmailNotification
      const emailId = email.id || email.notificationId;
      const emailTo = email.to || email.recipient;

      this.logger.info(
        { emailId, to: emailTo },
        "Processing email notification",
      );

      // For now, use template code and payload as subject/body
      const emailData = {
        ...email,
        id: emailId,
        to: emailTo,
        subject: email.subject || `${email.templateCode} Notification`,
        body: email.body || JSON.stringify(email.payload || {}),
      };

      // Select provider
      let result;
      const config = getConfig();

      if (config.EMAIL_PROVIDER === "sendgrid" && this.sendgridProvider) {
        result = await this.sendgridProvider.send(emailData);
      } else if (this.smtpProvider) {
        result = await this.smtpProvider.send(emailData);
      } else {
        throw new Error("No email provider configured");
      }

      // Update notification status to sent
      await db.notification.update({
        where: { id: emailId },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      this.logger.info(
        { emailId, messageId: result.messageId },
        "Email sent successfully",
      );
    } catch (error) {
      const emailId = email?.id || email?.notificationId;
      this.logger.error(
        { error, emailId },
        "Failed to process email",
      );

      // Update notification status to failed
      try {
        if (emailId) {
          await db.notification.update({
            where: { id: emailId },
            data: {
              status: "FAILED",
            },
          });
        }
      } catch (updateError) {
        this.logger.error(updateError, "Failed to update notification status");
      }

      throw error;
    }
  }
}

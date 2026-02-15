import pino from "pino";
import { db } from "@shared/db";
import { getConfig } from "@shared/config";
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

      // Use rendered template from message, or fallback to defaults
      const emailData = {
        ...email,
        id: emailId,
        to: emailTo,
        // If subject/body are provided (pre-rendered from API), use them
        // Otherwise fallback to templateCode as subject and payload as body
        subject: email.subject || `${email.templateCode} Notification`,
        body: email.body || (email.payload ? JSON.stringify(email.payload) : ''),
      };

      this.logger.debug(
        { emailId, hasBody: !!email.body, hasSubject: !!email.subject, templateCode: email.templateCode },
        "Email data prepared for sending",
      );

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

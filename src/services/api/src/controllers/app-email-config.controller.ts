import { FastifyRequest, FastifyReply } from 'fastify';
import { AppEmailConfigService } from '../services/app-email-config.service';
import { DNSVerificationService } from '../services/dns-verification.service';
import { logger } from '../config/logger';

export class AppEmailConfigController {
  /**
   * GET /api/apps/:appId/email-config
   * Get email configuration for an app
   */
  async getEmailConfig(req: FastifyRequest<{ Params: { appId: string } }>, res: FastifyReply) {
    try {
      const { appId } = req.params;
      const config = await AppEmailConfigService.getEmailConfigForApp(appId);

      return res.code(200).send({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get email config');
      return res.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get email config',
      });
    }
  }

  /**
   * POST /api/apps/:appId/email-config
   * Set custom email configuration for an app
   */
  async setEmailConfig(
    req: FastifyRequest<{
      Params: { appId: string };
      Body: {
        fromEmail: string;
        fromName?: string;
        replyToEmail?: string;
        replyToName?: string;
      };
    }>,
    res: FastifyReply
  ) {
    try {
      const { appId } = req.params;
      const { fromEmail, fromName, replyToEmail, replyToName } = req.body;

      // Validate email format
      if (!AppEmailConfigService.validateEmailAddress(fromEmail)) {
        return res.code(400).send({
          success: false,
          error: 'Invalid email format for fromEmail',
        });
      }

      if (replyToEmail && !AppEmailConfigService.validateEmailAddress(replyToEmail)) {
        return res.code(400).send({
          success: false,
          error: 'Invalid email format for replyToEmail',
        });
      }

      const config = await AppEmailConfigService.setEmailConfig(appId, {
        fromEmail,
        fromName,
        replyToEmail,
        replyToName,
      });

      return res.code(200).send({
        success: true,
        data: {
          fromEmail: config.from_email,
          fromName: config.from_name,
          replyToEmail: config.reply_to_email,
          replyToName: config.reply_to_name,
          isVerified: config.is_verified,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to set email config');
      return res.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set email config',
      });
    }
  }

  /**
   * DELETE /api/apps/:appId/email-config
   * Reset email configuration to platform default
   */
  async resetEmailConfig(req: FastifyRequest<{ Params: { appId: string } }>, res: FastifyReply) {
    try {
      const { appId } = req.params;
      await AppEmailConfigService.resetToDefault(appId);

      return res.code(200).send({
        success: true,
        message: 'Email configuration reset to platform default',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to reset email config');
      return res.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset email config',
      });
    }
  }

  /**
   * POST /api/apps/:appId/email-config/verify-dns
   * Verify DNS records for a custom sender email
   */
  async verifyDNS(
    req: FastifyRequest<{
      Params: { appId: string };
      Body: { email: string };
    }>,
    res: FastifyReply
  ) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.code(400).send({
          success: false,
          error: 'Email address is required',
        });
      }

      const verificationResult = await DNSVerificationService.verifyDomain(email);

      return res.code(200).send({
        success: true,
        data: verificationResult,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to verify DNS records');
      return res.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify DNS records',
      });
    }
  }
}

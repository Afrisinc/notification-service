import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { appEmailProviderService } from '../services/app-email-provider.service';
import { ApiResponseHelper } from '../utils/api-response';

export async function getEmailProvider(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;
    console.log('Getting email provider for appId:', appId, 'accountId:', accountId);

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    const config = await appEmailProviderService.getEmailProvider(appId);

    if (!config) {
      return ApiResponseHelper.success(reply, 'No email provider configured', null);
    }

    // Return config without sensitive fields
    return ApiResponseHelper.success(reply, 'Email provider retrieved', {
      id: config.id,
      provider: config.provider,
      method: config.method,
      isActive: config.is_active,
      // Simple
      fromEmail: config.from_email,
      fromName: config.from_name,
      // Gmail
      gmailEmail: config.gmail_email,
      gmailAuthMethod: config.gmail_auth_method,
      oauthTokenExpiry: config.oauth_token_expiry,
      // Custom Domain
      domain: config.domain,
      domainStatus: config.domain_status,
      spfVerified: config.spf_verified,
      dkimVerified: config.dkim_verified,
      dmarcVerified: config.dmarc_verified,
      createdAt: config.created_at,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get email provider');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve email provider');
  }
}

/**
 * POST /api/apps/:appId/email-provider/simple
 * Set simple sender configuration
 */
export async function setSimpleConfig(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const { fromEmail, fromName, replyToEmail, replyToName } = request.body as any;
    const accountId = request.headers['x-account-id'] as string | undefined;

    if (!fromEmail) {
      return ApiResponseHelper.missingFields(reply, 'fromEmail is required');
    }

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    const config = await appEmailProviderService.setSimpleConfig(appId, {
      fromEmail,
      fromName,
      replyToEmail,
      replyToName,
    });

    logger.info({ appId }, 'Simple email config set');

    return ApiResponseHelper.success(reply, 'Simple email configuration saved', {
      id: config.id,
      provider: config.provider,
      fromEmail: config.from_email,
      fromName: config.from_name,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to set simple config');
    return ApiResponseHelper.internalError(reply, 'Failed to save email configuration');
  }
}

/**
 * GET /api/apps/:appId/email-provider/gmail/oauth/url
 * Generate Google OAuth2 authorization URL
 */
export async function getGmailOAuthUrl(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const result = await appEmailProviderService.getGmailOAuthUrl(appId);
      return ApiResponseHelper.success(reply, 'OAuth URL generated', result);
    } catch (error) {
      return ApiResponseHelper.badRequest(
        reply,
        error instanceof Error ? error.message : 'Failed to generate OAuth URL'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to generate OAuth URL');
    return ApiResponseHelper.internalError(reply, 'Failed to generate OAuth URL');
  }
}

/**
 * POST /api/apps/:appId/email-provider/gmail/oauth/callback
 * Exchange OAuth code for tokens
 */
export async function handleGmailOAuthCallback(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const { code, state } = request.body as { code: string; state: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    if (!code || !state) {
      return ApiResponseHelper.missingFields(reply, 'Missing code or state parameter');
    }

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const emailConfig = await appEmailProviderService.handleGmailOAuthCallback(appId, code, state);
      return ApiResponseHelper.success(reply, 'Gmail account connected successfully', {
        id: emailConfig.id,
        provider: emailConfig.provider,
        method: emailConfig.method,
        gmailEmail: emailConfig.gmail_email,
        isActive: emailConfig.is_active,
      });
    } catch (error) {
      return ApiResponseHelper.badRequest(
        reply,
        error instanceof Error ? error.message : 'Failed to process OAuth callback'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to handle OAuth callback');
    return ApiResponseHelper.internalError(reply, 'Failed to process OAuth callback');
  }
}

/**
 * POST /api/apps/:appId/email-provider/gmail/app-password
 * Set Gmail app password
 */
export async function setGmailAppPassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const { email, appPassword } = request.body as { email: string; appPassword: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    if (!email || !appPassword) {
      return ApiResponseHelper.missingFields(reply, 'Email and app password are required');
    }

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const emailConfig = await appEmailProviderService.setGmailAppPassword(appId, email, appPassword);
      return ApiResponseHelper.success(reply, 'Gmail app password saved successfully', {
        id: emailConfig.id,
        provider: emailConfig.provider,
        method: emailConfig.method,
        gmailEmail: emailConfig.gmail_email,
        isActive: emailConfig.is_active,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save Gmail configuration';
      // Check if it's a credentials error
      if (message.includes('Invalid Gmail credentials') || message.includes('Invalid email')) {
        return ApiResponseHelper.invalidCredentials(reply, message);
      }
      return ApiResponseHelper.badRequest(reply, message);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
      'Failed to set Gmail app password'
    );
    return ApiResponseHelper.internalError(reply, 'Failed to save Gmail configuration');
  }
}

/**
 * DELETE /api/apps/:appId/email-provider
 * Reset to default email provider
 */
export async function resetEmailProvider(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await appEmailProviderService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const result = await appEmailProviderService.resetEmailProvider(appId);
      if (!result) {
        return ApiResponseHelper.success(reply, 'Email provider already reset');
      }
      return ApiResponseHelper.success(reply, 'Email provider reset successfully');
    } catch (error) {
      return ApiResponseHelper.badRequest(
        reply,
        error instanceof Error ? error.message : 'Failed to reset email provider'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Failed to reset email provider');
    return ApiResponseHelper.internalError(reply, 'Failed to reset email provider');
  }
}

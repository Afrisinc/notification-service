import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { emailIdentityService } from '../services/email-identity.service';
import { ApiResponseHelper } from '../utils/api-response';

function serializeDomain(domain: any) {
  return {
    id: domain.id,
    domain: domain.domain,
    selector: domain.selector,
    status: domain.status,
    spfVerified: domain.spf_verified,
    dkimVerified: domain.dkim_verified,
    dmarcVerified: domain.dmarc_verified,
    verifiedAt: domain.verified_at,
    cloudflareConnected: domain.cloudflare_connected,
    createdAt: domain.created_at,
    senders: (domain.senders || []).map(serializeSender),
  };
}

function serializeSender(sender: any) {
  return {
    id: sender.id,
    localPart: sender.local_part,
    fromName: sender.from_name,
    replyToEmail: sender.reply_to_email,
    replyToName: sender.reply_to_name,
    isDefault: sender.is_default,
    isActive: sender.is_active,
    createdAt: sender.created_at,
  };
}

export async function listEmailDomains(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    const domains = await emailIdentityService.listDomains(appId);
    return ApiResponseHelper.success(reply, 'Email domains retrieved', domains.map(serializeDomain));
  } catch (error) {
    logger.error({ error }, 'Failed to list email domains');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve email domains');
  }
}

export async function addEmailDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = request.params as { appId: string };
    const { domain, selector, cloudflareApiToken } = request.body as {
      domain: string;
      selector?: string;
      cloudflareApiToken?: string;
    };
    const accountId = request.headers['x-account-id'] as string | undefined;

    if (!domain) {
      return ApiResponseHelper.missingFields(reply, 'Domain is required');
    }

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const result = await emailIdentityService.addDomain(appId, domain, selector, cloudflareApiToken);
      logger.info({ appId, domain, cloudflareUsed: !!cloudflareApiToken }, 'Email domain added');

      return ApiResponseHelper.success(reply, 'Domain added', {
        domain: serializeDomain(result.domain),
        cloudflare: result.cloudflare,
      });
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to add domain');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to add email domain');
    return ApiResponseHelper.internalError(reply, 'Failed to add email domain');
  }
}

export async function getEmailDomainRecords(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = request.params as { appId: string; domainId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    const records = await emailIdentityService.getDomainRecords(domainId);
    if (!records) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }

    return ApiResponseHelper.success(reply, 'DNS records retrieved', records);
  } catch (error) {
    logger.error({ error }, 'Failed to get DNS records');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve DNS records');
  }
}

export async function verifyEmailDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = request.params as { appId: string; domainId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const domain = await emailIdentityService.verifyDomain(domainId);
      return ApiResponseHelper.success(reply, 'Verification completed', serializeDomain(domain));
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to verify domain');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to verify email domain');
    return ApiResponseHelper.internalError(reply, 'Failed to verify domain');
  }
}

export async function deleteEmailDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = request.params as { appId: string; domainId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      await emailIdentityService.deleteDomain(appId, domainId);
      return ApiResponseHelper.success(reply, 'Domain removed');
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to remove domain');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete email domain');
    return ApiResponseHelper.internalError(reply, 'Failed to remove domain');
  }
}

export async function addEmailSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = request.params as { appId: string; domainId: string };
    const { localPart, fromName, replyToEmail, replyToName } = request.body as {
      localPart: string;
      fromName?: string;
      replyToEmail?: string;
      replyToName?: string;
    };
    const accountId = request.headers['x-account-id'] as string | undefined;

    if (!localPart) {
      return ApiResponseHelper.missingFields(reply, 'localPart is required');
    }

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const sender = await emailIdentityService.addSender(appId, domainId, {
        localPart,
        fromName,
        replyToEmail,
        replyToName,
      });
      return ApiResponseHelper.success(reply, 'Sender added', serializeSender(sender));
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to add sender');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to add email sender');
    return ApiResponseHelper.internalError(reply, 'Failed to add sender');
  }
}

export async function updateEmailSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, senderId } = request.params as { appId: string; senderId: string };
    const { fromName, replyToEmail, replyToName, isDefault } = request.body as {
      fromName?: string;
      replyToEmail?: string;
      replyToName?: string;
      isDefault?: boolean;
    };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      const sender = await emailIdentityService.updateSender(appId, senderId, {
        fromName,
        replyToEmail,
        replyToName,
        isDefault,
      });
      return ApiResponseHelper.success(reply, 'Sender updated', serializeSender(sender));
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to update sender');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to update email sender');
    return ApiResponseHelper.internalError(reply, 'Failed to update sender');
  }
}

export async function deleteEmailSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, senderId } = request.params as { appId: string; senderId: string };
    const accountId = request.headers['x-account-id'] as string | undefined;

    const owns = await emailIdentityService.verifyAppOwnership(appId, accountId);
    if (!owns) {
      return ApiResponseHelper.forbidden(reply, 'You do not own this app');
    }

    try {
      await emailIdentityService.deleteSender(appId, senderId);
      return ApiResponseHelper.success(reply, 'Sender removed');
    } catch (error) {
      return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to remove sender');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete email sender');
    return ApiResponseHelper.internalError(reply, 'Failed to remove sender');
  }
}

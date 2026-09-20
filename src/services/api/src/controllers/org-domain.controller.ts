import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { orgDomainService } from '../services/org-domain.service';
import { OrganizationService } from '../services/organization.service';
import { ApiResponseHelper } from '../utils/api-response';

const organizationService = new OrganizationService();

/**
 * `domainName` covers senders fetched through their parent EmailDomain (see
 * serializeDomain below) - that path doesn't load the sender's own `domain`
 * relation back (would be a redundant self-join), so the parent already
 * knows the domain string and passes it down instead.
 */
function serializeSender(sender: any, domainName?: string) {
  const resolvedDomainName = sender.domain?.domain ?? domainName;
  return {
    id: sender.id,
    localPart: sender.local_part,
    fromName: sender.from_name,
    replyToEmail: sender.reply_to_email,
    replyToName: sender.reply_to_name,
    isActive: sender.is_active,
    assignedUserId: sender.assigned_user_id,
    assignedUser: sender.assignedUser
      ? {
          id: sender.assignedUser.id,
          email: sender.assignedUser.email,
          firstName: sender.assignedUser.firstName,
          lastName: sender.assignedUser.lastName,
        }
      : undefined,
    address: resolvedDomainName ? `${sender.local_part}@${resolvedDomainName}` : undefined,
    domainId: sender.domain_id,
    createdAt: sender.created_at,
  };
}

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
    inboundEnabled: domain.inbound_enabled,
    mxVerified: domain.mx_verified,
    createdAt: domain.created_at,
    senders: (domain.senders || []).map((sender: any) => serializeSender(sender, domain.domain)),
  };
}

export async function listOrgDomains(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const domains = await orgDomainService.listDomains(orgId);
    return ApiResponseHelper.success(reply, 'Domains retrieved', domains.map(serializeDomain));
  } catch (error) {
    logger.error({ error }, 'Failed to list organization domains');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve domains');
  }
}

export async function addOrgDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const { domain, selector, cloudflareApiToken } = request.body as {
      domain: string;
      selector?: string;
      cloudflareApiToken?: string;
    };

    if (!domain) {
      return ApiResponseHelper.missingFields(reply, 'Domain is required');
    }

    const result = await orgDomainService.addDomain(orgId, domain, selector, cloudflareApiToken);
    return ApiResponseHelper.success(reply, 'Domain added', {
      domain: serializeDomain(result.domain),
      cloudflare: result.cloudflare,
      usedOrgDefault: result.usedOrgDefault,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to add organization domain');
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to add domain');
  }
}

/** Whether the organization has a default Cloudflare API token configured (never returns the token itself). */
export async function getOrgCloudflareSettings(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const status = await organizationService.getCloudflareStatus(orgId);
    return ApiResponseHelper.success(reply, 'Cloudflare settings retrieved', status);
  } catch (error) {
    logger.error({ error }, 'Failed to get organization Cloudflare settings');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve Cloudflare settings');
  }
}

/** Set the organization's default Cloudflare API token, used for any domain added without its own token. */
export async function updateOrgCloudflareSettings(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const { cloudflareApiToken } = request.body as { cloudflareApiToken: string };

    if (!cloudflareApiToken) {
      return ApiResponseHelper.missingFields(reply, 'cloudflareApiToken is required');
    }

    const status = await organizationService.setCloudflareToken(orgId, cloudflareApiToken);
    return ApiResponseHelper.success(reply, 'Cloudflare token saved', status);
  } catch (error) {
    logger.error({ error }, 'Failed to update organization Cloudflare settings');
    return ApiResponseHelper.badRequest(
      reply,
      error instanceof Error ? error.message : 'Failed to save Cloudflare token'
    );
  }
}

export async function deleteOrgCloudflareSettings(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const status = await organizationService.clearCloudflareToken(orgId);
    return ApiResponseHelper.success(reply, 'Cloudflare token removed', status);
  } catch (error) {
    logger.error({ error }, 'Failed to clear organization Cloudflare settings');
    return ApiResponseHelper.internalError(reply, 'Failed to remove Cloudflare token');
  }
}

export async function getOrgDomainRecords(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    const records = await orgDomainService.getDomainRecords(orgId, domainId);
    if (!records) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }
    return ApiResponseHelper.success(reply, 'DNS records retrieved', records);
  } catch (error) {
    logger.error({ error }, 'Failed to get organization DNS records');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve DNS records');
  }
}

export async function verifyOrgDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    const domain = await orgDomainService.verifyDomain(orgId, domainId);
    return ApiResponseHelper.success(reply, 'Verification completed', serializeDomain(domain));
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to verify domain');
  }
}

export async function getOrgInboundMxRecord(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    const record = await orgDomainService.getMxRecord(orgId, domainId);
    if (!record) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }
    return ApiResponseHelper.success(reply, 'MX record retrieved', record);
  } catch (error) {
    logger.error({ error }, 'Failed to get organization MX record');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve MX record');
  }
}

export async function enableOrgInboundDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    const result = await orgDomainService.enableInbound(orgId, domainId);
    return ApiResponseHelper.success(reply, 'Inbound receiving updated', {
      domain: serializeDomain(result.domain),
      cloudflareConfigured: result.cloudflareConfigured,
    });
  } catch (error) {
    return ApiResponseHelper.badRequest(
      reply,
      error instanceof Error ? error.message : 'Failed to enable inbound receiving'
    );
  }
}

export async function deleteOrgDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    await orgDomainService.deleteDomain(orgId, domainId);
    return ApiResponseHelper.success(reply, 'Domain removed');
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to remove domain');
  }
}

export async function addOrgSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, domainId } = request.params as { orgId: string; domainId: string };
    const { localPart, fromName, replyToEmail, replyToName, assignedUserId } = request.body as {
      localPart: string;
      fromName?: string;
      replyToEmail?: string;
      replyToName?: string;
      assignedUserId?: string;
    };

    if (!localPart) {
      return ApiResponseHelper.missingFields(reply, 'localPart is required');
    }

    const sender = await orgDomainService.addSender(orgId, domainId, {
      localPart,
      fromName,
      replyToEmail,
      replyToName,
      assignedUserId,
    });
    return ApiResponseHelper.success(reply, 'Sender added', serializeSender(sender));
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to add sender');
  }
}

export async function updateOrgSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, senderId } = request.params as { orgId: string; senderId: string };
    const { fromName, replyToEmail, replyToName, assignedUserId } = request.body as {
      fromName?: string;
      replyToEmail?: string;
      replyToName?: string;
      assignedUserId?: string | null;
    };

    const sender = await orgDomainService.updateSender(orgId, senderId, {
      fromName,
      replyToEmail,
      replyToName,
      assignedUserId,
    });
    return ApiResponseHelper.success(reply, 'Sender updated', serializeSender(sender));
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to update sender');
  }
}

export async function deleteOrgSender(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId, senderId } = request.params as { orgId: string; senderId: string };
    await orgDomainService.deleteSender(orgId, senderId);
    return ApiResponseHelper.success(reply, 'Sender removed');
  } catch (error) {
    return ApiResponseHelper.badRequest(reply, error instanceof Error ? error.message : 'Failed to remove sender');
  }
}

export async function listMySenders(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const userId = (request as any).user?.id as string;
    const privileged = await organizationService.canManageOrganization(orgId, userId);

    const senders = await orgDomainService.listSendersForUser(orgId, userId, privileged);
    return ApiResponseHelper.success(
      reply,
      'Senders retrieved',
      senders.map((sender) => serializeSender(sender))
    );
  } catch (error) {
    logger.error({ error }, 'Failed to list senders for user');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve senders');
  }
}

export async function listOrgSenders(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { orgId } = request.params as { orgId: string };
    const senders = await orgDomainService.listSenders(orgId);
    return ApiResponseHelper.success(
      reply,
      'Senders retrieved',
      senders.map((sender) => serializeSender(sender))
    );
  } catch (error) {
    logger.error({ error }, 'Failed to list organization senders');
    return ApiResponseHelper.internalError(reply, 'Failed to retrieve senders');
  }
}

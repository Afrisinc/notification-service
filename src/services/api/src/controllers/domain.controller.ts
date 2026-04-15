import { FastifyRequest, FastifyReply } from 'fastify';
import { prismaRead } from '@shared/database';
import { customerDomainRepository } from '../repositories/customer-domain.repository';
import { dkimService } from '../services/dkim.service';
import { customDomainDNSService } from '../services/custom-domain-dns.service';
import { ApiResponseHelper } from '../utils';
import pino from 'pino';

const logger = pino();

/**
 * Verify that the app belongs to the authenticated account
 */
async function verifyAppOwnership(appId: string, accountId: string): Promise<boolean> {
  try {
    const app = await prismaRead.app.findFirst({
      where: {
        id: appId,
        account_id: accountId,
      },
    });
    return !!app;
  } catch (error) {
    logger.error({ error, appId, accountId }, 'Error checking app ownership');
    return false;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate domain format
 */
function isValidDomain(domain: string): boolean {
  // Domain should be lowercase, contain only alphanumeric, hyphens, and dots
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  return domainRegex.test(domain) && domain.length <= 255;
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

/**
 * POST /api/apps/:appId/domains
 * Add a new custom domain for an app
 */
export async function createDomain(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId } = req.params as { appId: string };
    const accountId = (req as any).user?.accountId || (req.headers['x-account-id'] as string);

    if (!appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Verify app ownership
    const appOwned = await verifyAppOwnership(appId, accountId);
    if (!appOwned) {
      return ApiResponseHelper.forbidden(reply, 'You do not have access to this app');
    }

    const body = req.body as {
      domain: string;
      fromName: string;
      fromEmail: string;
    };

    // Validate required fields
    if (!body.domain || !body.fromName || !body.fromEmail) {
      return ApiResponseHelper.badRequest(reply, 'domain, fromName, and fromEmail are required');
    }

    // Validate domain format
    if (!isValidDomain(body.domain)) {
      return ApiResponseHelper.badRequest(reply, 'Invalid domain format');
    }

    // Validate email format
    if (!isValidEmail(body.fromEmail)) {
      return ApiResponseHelper.badRequest(reply, 'Invalid email format');
    }

    // Validate fromName length
    if (body.fromName.length > 255) {
      return ApiResponseHelper.badRequest(reply, 'From name cannot exceed 255 characters');
    }

    // Check if domain already registered
    const existingDomain = await customerDomainRepository.findByDomain(body.domain);
    if (existingDomain) {
      return ApiResponseHelper.conflict(reply, 'Domain is already registered');
    }

    try {
      // Generate DKIM key pair
      const hostIp = process.env.HOST_IP || '0.0.0.0';
      const selector = 'afrisinc';

      const { publicKey, privateKeyPath } = await dkimService.generateKeyPair(body.domain, selector);

      // Save to database
      const domain = await customerDomainRepository.create({
        app_id: appId,
        domain: body.domain,
        from_name: body.fromName,
        from_email: body.fromEmail,
        selector,
        public_key: publicKey,
        private_key_path: privateKeyPath,
      });

      // Get DNS records
      const dnsRecords = customDomainDNSService.getDNSRecords(body.domain, publicKey, hostIp, selector);

      return ApiResponseHelper.success(
        reply,
        'Domain created successfully',
        {
          id: domain.id,
          domain: domain.domain,
          status: domain.status,
          dnsRecords,
        },
        201
      );
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      logger.error({ error: errorMsg }, 'DKIM key generation failed');
      return ApiResponseHelper.internalError(reply, 'Failed to generate DKIM keys');
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to create domain');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * GET /api/apps/:appId/domains/:domainId/records
 * Get DNS records for a domain
 */
export async function getDomainRecords(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = req.params as { appId: string; domainId: string };
    const accountId = (req as any).user?.accountId || (req.headers['x-account-id'] as string);

    if (!appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Verify app ownership
    const appOwned = await verifyAppOwnership(appId, accountId);
    if (!appOwned) {
      return ApiResponseHelper.forbidden(reply, 'You do not have access to this app');
    }

    const domain = await customerDomainRepository.findById(domainId, appId);

    if (!domain) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }

    const hostIp = process.env.HOST_IP || '0.0.0.0';
    const dnsRecords = customDomainDNSService.getDNSRecords(domain.domain, domain.public_key, hostIp, domain.selector);

    return ApiResponseHelper.success(reply, 'DNS records retrieved successfully', {
      id: domain.id,
      domain: domain.domain,
      fromName: domain.from_name,
      fromEmail: domain.from_email,
      status: domain.status,
      verified: {
        spf: domain.spf_verified,
        dkim: domain.dkim_verified,
        dmarc: domain.dmarc_verified,
      },
      dnsRecords,
      verifiedAt: domain.verified_at,
      createdAt: domain.createdAt,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to get domain records');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * POST /api/apps/:appId/domains/:domainId/verify
 * Verify DNS records for a domain
 */
export async function verifyDomain(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = req.params as { appId: string; domainId: string };
    const accountId = (req as any).user?.accountId || (req.headers['x-account-id'] as string);

    if (!appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Verify app ownership
    const appOwned = await verifyAppOwnership(appId, accountId);
    if (!appOwned) {
      return ApiResponseHelper.forbidden(reply, 'You do not have access to this app');
    }

    const domain = await customerDomainRepository.findById(domainId, appId);

    if (!domain) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }

    try {
      const hostIp = process.env.HOST_IP || '0.0.0.0';

      // Verify DNS records
      const result = await customDomainDNSService.verifyDomain(
        domain.domain,
        domain.public_key,
        hostIp,
        domain.selector
      );

      // Update database with verification results
      if (result.verified) {
        // All checks passed - activate on OpenDKIM
        try {
          await dkimService.addToSigningTable(domain.domain, domain.selector, domain.private_key_path);
          await dkimService.addToKeyTable(domain.domain, domain.selector, domain.private_key_path);
          await dkimService.reloadOpenDKIM();

          // Update domain status to verified
          await customerDomainRepository.updateVerification(domainId, {
            spf_verified: result.checks.spf,
            dkim_verified: result.checks.dkim,
            dmarc_verified: result.checks.dmarc,
            status: 'verified' as any,
            verified_at: new Date(),
          });

          logger.info({ domain: domain.domain }, 'Domain verified and activated in OpenDKIM');
        } catch (dkimError) {
          const errorMsg = getErrorMessage(dkimError);
          logger.error({ error: errorMsg, domain: domain.domain }, 'Failed to activate domain in OpenDKIM');
          // Mark DNS as verified but OpenDKIM activation failed
          await customerDomainRepository.updateVerification(domainId, {
            spf_verified: result.checks.spf,
            dkim_verified: result.checks.dkim,
            dmarc_verified: result.checks.dmarc,
          });

          return ApiResponseHelper.success(reply, 'DNS records verified but OpenDKIM activation failed', {
            verified: false,
            checks: result.checks,
            message: 'DNS records are valid. Contact support to complete activation.',
          });
        }
      } else {
        // Update only the verification flags without changing status
        await customerDomainRepository.updateVerification(domainId, {
          spf_verified: result.checks.spf,
          dkim_verified: result.checks.dkim,
          dmarc_verified: result.checks.dmarc,
        });
      }

      return ApiResponseHelper.success(reply, 'Domain verification completed', {
        verified: result.verified,
        checks: result.checks,
      });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      logger.error({ error: errorMsg }, 'DNS verification failed');
      return ApiResponseHelper.internalError(reply, 'Failed to verify DNS records');
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to verify domain');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * PATCH /api/apps/:appId/domains/:domainId
 * Update domain from name and email
 */
export async function updateDomain(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = req.params as { appId: string; domainId: string };
    const accountId = (req as any).user?.accountId || (req.headers['x-account-id'] as string);

    if (!appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Verify app ownership
    const appOwned = await verifyAppOwnership(appId, accountId);
    if (!appOwned) {
      return ApiResponseHelper.forbidden(reply, 'You do not have access to this app');
    }

    const body = req.body as {
      fromName?: string;
      fromEmail?: string;
    };

    // Validate email if provided
    if (body.fromEmail && !isValidEmail(body.fromEmail)) {
      return ApiResponseHelper.badRequest(reply, 'Invalid email format');
    }

    // Validate fromName length if provided
    if (body.fromName && body.fromName.length > 255) {
      return ApiResponseHelper.badRequest(reply, 'From name cannot exceed 255 characters');
    }

    const domain = await customerDomainRepository.findById(domainId, appId);

    if (!domain) {
      return ApiResponseHelper.notFound(reply, 'Domain not found');
    }

    if (domain.status !== 'verified') {
      return ApiResponseHelper.badRequest(reply, 'Only verified domains can be updated');
    }

    const updated = await customerDomainRepository.update(domainId, {
      from_name: body.fromName || domain.from_name,
      from_email: body.fromEmail || domain.from_email,
    });

    return ApiResponseHelper.success(reply, 'Domain updated successfully', {
      success: true,
      domain: updated,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to update domain');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

/**
 * DELETE /api/apps/:appId/domains/:domainId
 * Delete a custom domain
 */
export async function deleteDomain(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { appId, domainId } = req.params as { appId: string; domainId: string };
    const accountId = (req as any).user?.accountId || (req.headers['x-account-id'] as string);

    if (!appId) {
      return ApiResponseHelper.badRequest(reply, 'App ID is required');
    }

    if (!accountId) {
      return ApiResponseHelper.unauthorized(reply, 'Account information not found');
    }

    // Verify app ownership
    const appOwned = await verifyAppOwnership(appId, accountId);
    if (!appOwned) {
      return ApiResponseHelper.forbidden(reply, 'You do not have access to this app');
    }

    const domain = await customerDomainRepository.findById(domainId, appId);

    if (!domain) {
      // Idempotent: return success even if already deleted
      return ApiResponseHelper.success(reply, 'Domain deleted successfully', {
        success: true,
      });
    }

    try {
      // Remove from OpenDKIM if it was verified
      if (domain.status === 'verified') {
        try {
          await dkimService.removeFromDKIMTables(domain.domain, domain.selector);
          await dkimService.reloadOpenDKIM();
        } catch (error) {
          logger.warn({ error }, 'Failed to remove from OpenDKIM tables');
        }
      }

      // Delete DKIM keys
      try {
        await dkimService.deleteKeys(domain.domain);
      } catch (error) {
        logger.warn({ error }, 'Failed to delete DKIM keys');
      }

      // Delete from database
      await customerDomainRepository.delete(domainId);

      return ApiResponseHelper.success(reply, 'Domain deleted successfully', {
        success: true,
      });
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      logger.error({ error: errorMsg }, 'Error during domain deletion');
      return ApiResponseHelper.internalError(reply, 'Failed to delete domain');
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error({ error: errorMessage }, 'Failed to delete domain');
    return ApiResponseHelper.badRequest(reply, errorMessage);
  }
}

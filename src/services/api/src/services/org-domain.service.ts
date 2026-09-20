import { encrypt, decrypt } from '@shared/utils/encryption';
import { logger } from '../config/logger';
import { EmailDomainRepository, EmailSenderRepository } from '../repositories/email-identity.repository';
import { dkimService } from './dkim.service';
import { dnsVerifyService } from './dns-verify.service';
import { cloudflareService, type CloudflareDNSRecord } from './cloudflare.service';
import { OrganizationService } from './organization.service';
import { env } from '../config/env';
import type { DomainDNSRecords } from './email-identity.service';

const organizationService = new OrganizationService();

function buildDNSRecords(domain: string, selector: string, publicKey: string | null): CloudflareDNSRecord[] {
  return [
    { type: 'TXT', name: domain, content: 'v=spf1 include:mail.afrisinc.com ~all' },
    { type: 'TXT', name: `${selector}._domainkey.${domain}`, content: `v=DKIM1; k=rsa; p=${publicKey || ''}` },
    { type: 'TXT', name: `_dmarc.${domain}`, content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@afrisinc.com' },
  ];
}

/**
 * Organization-level custom domains and sender identities - a parallel,
 * independent flow to EmailIdentityService's per-App domains. A domain
 * managed here belongs directly to the Organization (never to any single
 * App), and its senders can be assigned to specific members. Nothing here
 * touches AppEmailProvider - inbox sending resolves DKIM straight from the
 * chosen EmailDomain/EmailSender (see inbox.service.ts), independent of any
 * app's active provider configuration.
 */
export class OrgDomainService {
  async listDomains(orgId: string) {
    return EmailDomainRepository.findByOrg(orgId);
  }

  async getMxRecord(
    orgId: string,
    domainId: string
  ): Promise<{ domain: string; host: string; verified: boolean } | null> {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) return null;
    return { domain: domain.domain, host: env.INBOUND_MX_HOST, verified: domain.mx_verified };
  }

  async enableInbound(orgId: string, domainId: string) {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    // Only attempt the Cloudflare auto-write the first time this domain is
    // enabled. Once enabled, re-checking (this same method, called again by
    // "Re-check MX record" or the background auto-retry) must do a real DNS
    // lookup instead of re-running the Cloudflare upsert - that call
    // "succeeds" every time since the record already matches, which would
    // otherwise keep skipping verification forever and the domain could
    // never flip to verified.
    let cloudflareConfigured = false;
    if (!domain.inbound_enabled) {
      // Prefer the domain's own stored Cloudflare token (already proven to
      // have zone access, since it's what configured this domain's
      // SPF/DKIM/DMARC records) and fall back to the organization's default.
      const token = domain.cloudflare_api_token
        ? decrypt(domain.cloudflare_api_token)
        : await organizationService.getDecryptedCloudflareToken(orgId);

      if (token) {
        const result = await cloudflareService.configureMxRecord(token, domain.domain, env.INBOUND_MX_HOST);
        if (result.success) {
          cloudflareConfigured = true;
        } else {
          logger.warn(
            { orgId, domainId, domain: domain.domain, error: result.error },
            'Cloudflare MX auto-configuration failed, falling back to manual DNS'
          );
        }
      }
    }

    // If we just wrote the record ourselves, don't check DNS synchronously -
    // same propagation-lag reasoning as addDomain's SPF/DKIM/DMARC records
    // (see addDomain above). Otherwise (no token, or Cloudflare failed) this
    // is a real user-triggered manual check, so verify live as before.
    const verified = cloudflareConfigured ? false : await dnsVerifyService.verifyMX(domain.domain, env.INBOUND_MX_HOST);

    const updated = await EmailDomainRepository.updateInbound(domainId, {
      inbound_enabled: true,
      mx_verified: verified,
      mx_verified_at: verified ? new Date() : null,
    });

    return { domain: updated, cloudflareConfigured };
  }

  async getDomainRecords(orgId: string, domainId: string): Promise<DomainDNSRecords | null> {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) return null;

    const records = buildDNSRecords(domain.domain, domain.selector, domain.dkim_public_key);
    return {
      domain: domain.domain,
      spf: { name: records[0].name, value: records[0].content, verified: domain.spf_verified },
      dkim: { name: records[1].name, value: records[1].content, verified: domain.dkim_verified },
      dmarc: { name: records[2].name, value: records[2].content, verified: domain.dmarc_verified },
    };
  }

  async addDomain(orgId: string, domain: string, selector: string | undefined, cloudflareApiToken?: string) {
    const sel = selector || 'afrisinc';

    logger.info({ orgId, domain }, 'Generating DKIM key pair for new organization email domain');
    const { publicKey, privateKeyPath } = await dkimService.generateKeyPair(domain, sel);
    await dkimService.addToSigningTable(domain);
    await dkimService.addToKeysTable(domain, sel);
    await dkimService.reloadOpenDKIM();

    const created = await EmailDomainRepository.createForOrg(orgId, {
      domain,
      selector: sel,
      dkim_public_key: publicKey,
      dkim_private_key_path: privateKeyPath,
    });

    // Fall back to the organization's default Cloudflare token (set in
    // Organization Settings) when this call didn't bring its own.
    const usedOrgDefault = !cloudflareApiToken;
    const token = cloudflareApiToken || (await organizationService.getDecryptedCloudflareToken(orgId)) || undefined;

    if (!token) {
      return { domain: created, cloudflare: null, usedOrgDefault: false };
    }

    const records = buildDNSRecords(domain, sel, publicKey);
    const result = await cloudflareService.configureDomainRecords(token, domain, records);

    if (!result.success) {
      logger.warn(
        { orgId, domain, error: result.error, usedOrgDefault },
        'Cloudflare auto-configuration failed, falling back to manual DNS'
      );
      return { domain: created, cloudflare: result, usedOrgDefault };
    }

    const updated = await EmailDomainRepository.updateCloudflareConnection(created.id, {
      cloudflare_zone_id: result.zoneId || null,
      cloudflare_api_token: encrypt(token),
      cloudflare_connected: true,
    });

    // Deliberately not verifying DNS synchronously here: Cloudflare
    // confirming the write doesn't mean the record is resolvable
    // everywhere yet (propagation lag, or a stale negative-cache entry from
    // an earlier attempt at this hostname), so checking immediately is
    // racy and would often report "unverified" even when the records were
    // written correctly. It also adds 3 more blocking DNS lookups on top of
    // the DKIM SSH round-trips already in this request, risking a client
    // timeout. The domain comes back "pending" - the client re-checks via
    // verifyDomain (POST /domains/:id/verify) once records have had a
    // moment to propagate.
    return { domain: updated, cloudflare: result, usedOrgDefault };
  }

  async verifyDomain(orgId: string, domainId: string) {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const [spfVerified, dkimVerified, dmarcVerified] = await Promise.all([
      dnsVerifyService.verifySPF(domain.domain),
      dnsVerifyService.verifyDKIM(domain.selector, domain.domain),
      dnsVerifyService.verifyDMARC(domain.domain),
    ]);

    const allVerified = spfVerified && dkimVerified && dmarcVerified;

    return EmailDomainRepository.updateVerification(domainId, {
      spf_verified: spfVerified,
      dkim_verified: dkimVerified,
      dmarc_verified: dmarcVerified,
      status: allVerified ? 'verified' : 'pending',
      verified_at: allVerified ? new Date() : null,
    });
  }

  async deleteDomain(orgId: string, domainId: string) {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    await EmailDomainRepository.delete(domainId);
    await dkimService.removeFromDKIMTables(domain.domain).catch(() => undefined);
    await dkimService.deleteKeys(domain.domain).catch(() => undefined);
  }

  async addSender(
    orgId: string,
    domainId: string,
    data: { localPart: string; fromName?: string; replyToEmail?: string; replyToName?: string; assignedUserId?: string }
  ) {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }
    if (domain.status !== 'verified') {
      throw new Error('This domain must be verified before you can create sender addresses under it');
    }

    return EmailSenderRepository.create(domainId, {
      local_part: data.localPart,
      from_name: data.fromName ?? null,
      reply_to_email: data.replyToEmail ?? null,
      reply_to_name: data.replyToName ?? null,
      assigned_user_id: data.assignedUserId ?? null,
    });
  }

  async updateSender(
    orgId: string,
    senderId: string,
    data: { fromName?: string; replyToEmail?: string; replyToName?: string; assignedUserId?: string | null }
  ) {
    const sender = await this.findOwnedSender(orgId, senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    return EmailSenderRepository.update(senderId, {
      from_name: data.fromName,
      reply_to_email: data.replyToEmail,
      reply_to_name: data.replyToName,
      assigned_user_id: data.assignedUserId,
    });
  }

  async deleteSender(orgId: string, senderId: string) {
    const sender = await this.findOwnedSender(orgId, senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }
    await EmailSenderRepository.delete(senderId);
  }

  /** Every sender in the org, for the owner/admin management view. */
  async listSenders(orgId: string) {
    return EmailSenderRepository.findByOrg(orgId);
  }

  /** Senders a given member may compose/reply as - all of them if privileged, else only their own assignments. */
  async listSendersForUser(orgId: string, userId: string, privileged: boolean) {
    return EmailSenderRepository.findForUser(orgId, userId, privileged);
  }

  async getCloudflareToken(orgId: string, domainId: string): Promise<string | null> {
    const domain = await this.findOwnedDomain(orgId, domainId);
    if (!domain?.cloudflare_api_token) return null;
    return decrypt(domain.cloudflare_api_token);
  }

  private async findOwnedDomain(orgId: string, domainId: string) {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain || domain.organization_id !== orgId) return null;
    return domain;
  }

  private async findOwnedSender(orgId: string, senderId: string) {
    const sender = await EmailSenderRepository.findById(senderId);
    if (!sender || sender.domain.organization_id !== orgId) return null;
    return sender;
  }
}

export const orgDomainService = new OrgDomainService();

import { prismaRead } from '@shared/database';
import { encrypt, decrypt } from '@shared/utils/encryption';
import { logger } from '../config/logger';
import { EmailDomainRepository, EmailSenderRepository } from '../repositories/email-identity.repository';
import { AppEmailProviderRepository } from '../repositories/app-email-provider.repository';
import { dkimService } from './dkim.service';
import { dnsVerifyService } from './dns-verify.service';
import { cloudflareService, type CloudflareDNSRecord } from './cloudflare.service';

export interface DomainDNSRecords {
  domain: string;
  spf: { name: string; value: string; verified: boolean };
  dkim: { name: string; value: string; verified: boolean };
  dmarc: { name: string; value: string; verified: boolean };
}

function buildDNSRecords(domain: string, selector: string, publicKey: string | null): CloudflareDNSRecord[] {
  return [
    { type: 'TXT', name: domain, content: 'v=spf1 include:mail.afrisinc.com ~all' },
    { type: 'TXT', name: `${selector}._domainkey.${domain}`, content: `v=DKIM1; k=rsa; p=${publicKey || ''}` },
    { type: 'TXT', name: `_dmarc.${domain}`, content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@afrisinc.com' },
  ];
}

export class EmailIdentityService {
  async verifyAppOwnership(appId: string, accountId?: string): Promise<boolean> {
    const app = await prismaRead.app.findUnique({ where: { id: appId } });
    if (!app) return false;
    if (!accountId) return true;
    return app.account_id === accountId;
  }

  async listDomains(appId: string) {
    return EmailDomainRepository.findByApp(appId);
  }

  async getDomainRecords(domainId: string): Promise<DomainDNSRecords | null> {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain) return null;

    const records = buildDNSRecords(domain.domain, domain.selector, domain.dkim_public_key);
    return {
      domain: domain.domain,
      spf: { name: records[0].name, value: records[0].content, verified: domain.spf_verified },
      dkim: { name: records[1].name, value: records[1].content, verified: domain.dkim_verified },
      dmarc: { name: records[2].name, value: records[2].content, verified: domain.dmarc_verified },
    };
  }

  /**
   * Add a new sending domain for an app: generates DKIM keys on the mail
   * server (unchanged flow from the single-domain feature), then either
   * auto-configures DNS via Cloudflare (if a token is supplied) or leaves it
   * pending for the user to add the records manually.
   */
  async addDomain(appId: string, domain: string, selector: string | undefined, cloudflareApiToken?: string) {
    const sel = selector || 'afrisinc';

    logger.info({ appId, domain }, 'Generating DKIM key pair for new email domain');
    const { publicKey, privateKeyPath } = await dkimService.generateKeyPair(domain, sel);
    await dkimService.addToSigningTable(domain);
    await dkimService.addToKeysTable(domain, sel);
    await dkimService.reloadOpenDKIM();

    const created = await EmailDomainRepository.create(appId, {
      domain,
      selector: sel,
      dkim_public_key: publicKey,
      dkim_private_key_path: privateKeyPath,
    });

    if (!cloudflareApiToken) {
      return { domain: created, cloudflare: null };
    }

    const records = buildDNSRecords(domain, sel, publicKey);
    const result = await cloudflareService.configureDomainRecords(cloudflareApiToken, domain, records);

    if (!result.success) {
      logger.warn(
        { appId, domain, error: result.error },
        'Cloudflare auto-configuration failed, falling back to manual DNS'
      );
      return { domain: created, cloudflare: result };
    }

    await EmailDomainRepository.updateCloudflareConnection(created.id, {
      cloudflare_zone_id: result.zoneId || null,
      cloudflare_api_token: encrypt(cloudflareApiToken),
      cloudflare_connected: true,
    });

    // Cloudflare propagates near-instantly, so verification usually succeeds immediately.
    const verified = await this.verifyDomain(created.id);

    return { domain: verified, cloudflare: result };
  }

  /**
   * Re-check SPF/DKIM/DMARC DNS records for a domain and persist the result.
   * If this domain currently backs the app's active sender, the refreshed
   * verification flags are also synced onto AppEmailProvider.
   */
  async verifyDomain(domainId: string) {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    const [spfVerified, dkimVerified, dmarcVerified] = await Promise.all([
      dnsVerifyService.verifySPF(domain.domain),
      dnsVerifyService.verifyDKIM(domain.selector, domain.domain),
      dnsVerifyService.verifyDMARC(domain.domain),
    ]);

    const allVerified = spfVerified && dkimVerified && dmarcVerified;

    const updated = await EmailDomainRepository.updateVerification(domainId, {
      spf_verified: spfVerified,
      dkim_verified: dkimVerified,
      dmarc_verified: dmarcVerified,
      status: allVerified ? 'verified' : 'pending',
      verified_at: allVerified ? new Date() : null,
    });

    const activeProvider = await AppEmailProviderRepository.findByAppId(domain.app_id);
    if (activeProvider?.provider === 'custom_domain' && activeProvider.domain === domain.domain) {
      await AppEmailProviderRepository.upsert(domain.app_id, {
        domain_status: updated.status,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        dmarc_verified: dmarcVerified,
      });
    }

    return updated;
  }

  async deleteDomain(appId: string, domainId: string) {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain || domain.app_id !== appId) {
      throw new Error('Domain not found');
    }

    const activeProvider = await AppEmailProviderRepository.findByAppId(appId);
    const wasActive = activeProvider?.provider === 'custom_domain' && activeProvider.domain === domain.domain;

    await EmailDomainRepository.delete(domainId);
    await dkimService.removeFromDKIMTables(domain.domain).catch(() => undefined);
    await dkimService.deleteKeys(domain.domain).catch(() => undefined);

    if (wasActive) {
      await AppEmailProviderRepository.delete(appId).catch(() => undefined);
    }

    return { wasActive };
  }

  async addSender(
    appId: string,
    domainId: string,
    data: { localPart: string; fromName?: string; replyToEmail?: string; replyToName?: string }
  ) {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain || domain.app_id !== appId) {
      throw new Error('Domain not found');
    }

    return EmailSenderRepository.create(domainId, {
      local_part: data.localPart,
      from_name: data.fromName ?? null,
      reply_to_email: data.replyToEmail ?? null,
      reply_to_name: data.replyToName ?? null,
    });
  }

  async updateSender(
    appId: string,
    senderId: string,
    data: { fromName?: string; replyToEmail?: string; replyToName?: string; isDefault?: boolean }
  ) {
    const sender = await EmailSenderRepository.findById(senderId);
    if (!sender || sender.domain.app_id !== appId) {
      throw new Error('Sender not found');
    }

    if (data.isDefault) {
      return this.setDefaultSender(appId, senderId);
    }

    return EmailSenderRepository.update(senderId, {
      from_name: data.fromName,
      reply_to_email: data.replyToEmail,
      reply_to_name: data.replyToName,
    });
  }

  async setDefaultSender(appId: string, senderId: string) {
    const sender = await EmailSenderRepository.findById(senderId);
    if (!sender || sender.domain.app_id !== appId) {
      throw new Error('Sender not found');
    }

    if (sender.domain.status !== 'verified') {
      throw new Error('Domain must be verified before it can be used to send email');
    }

    const updatedSender = await EmailSenderRepository.setAsDefault(appId, senderId);
    const domain = sender.domain;

    await AppEmailProviderRepository.upsert(appId, {
      provider: 'custom_domain',
      method: null,
      domain: domain.domain,
      selector: domain.selector,
      public_key: domain.dkim_public_key,
      private_key_path: domain.dkim_private_key_path,
      domain_status: domain.status,
      spf_verified: domain.spf_verified,
      dkim_verified: domain.dkim_verified,
      dmarc_verified: domain.dmarc_verified,
      from_email: `${sender.local_part}@${domain.domain}`,
      from_name: sender.from_name,
      reply_to_email: sender.reply_to_email,
      reply_to_name: sender.reply_to_name,
      is_active: true,
      gmail_email: null,
      gmail_auth_method: null,
      oauth_access_token: null,
      oauth_refresh_token: null,
      oauth_token_expiry: null,
      app_password: null,
    });

    return updatedSender;
  }

  async deleteSender(appId: string, senderId: string) {
    const sender = await EmailSenderRepository.findById(senderId);
    if (!sender || sender.domain.app_id !== appId) {
      throw new Error('Sender not found');
    }

    if (sender.is_default) {
      const remainingSenders = await EmailDomainRepository.findByApp(appId);
      const totalSenders = remainingSenders.reduce((sum, d) => sum + d.senders.length, 0);

      if (totalSenders > 1) {
        throw new Error('Cannot delete the default sender while other senders exist. Set a different default first.');
      }

      await AppEmailProviderRepository.delete(appId).catch(() => undefined);
    }

    await EmailSenderRepository.delete(senderId);
  }

  /** Decrypt a domain's stored Cloudflare token for re-use (e.g. re-verification after a manual DNS edit). */
  async getCloudflareToken(domainId: string): Promise<string | null> {
    const domain = await EmailDomainRepository.findById(domainId);
    if (!domain?.cloudflare_api_token) return null;
    return decrypt(domain.cloudflare_api_token);
  }
}

export const emailIdentityService = new EmailIdentityService();

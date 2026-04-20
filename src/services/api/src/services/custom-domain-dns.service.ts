import { promises as dns } from 'dns';
import { logger } from '../config/logger';

export interface DomainDNSRecord {
  type: 'TXT';
  name: string;
  value: string;
  label: string;
  purpose: string;
}

export interface DNSVerificationChecks {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
}

export interface DNSVerificationResult {
  verified: boolean;
  checks: DNSVerificationChecks;
}

export class CustomDomainDNSService {
  /**
   * Verify all DNS records for a custom domain
   */
  async verifyDomain(
    domain: string,
    publicKey: string,
    hostIp: string,
    selector: string = 'afrisinc'
  ): Promise<DNSVerificationResult> {
    try {
      const [spf, dkim, dmarc] = await Promise.all([
        this.verifySPF(domain, hostIp),
        this.verifyDKIM(domain, publicKey, selector),
        this.verifyDMARC(domain),
      ]);

      const verified = spf && dkim && dmarc;

      return {
        verified,
        checks: { spf, dkim, dmarc },
      };
    } catch (error) {
      logger.error({ error, domain }, 'DNS verification error');
      return {
        verified: false,
        checks: { spf: false, dkim: false, dmarc: false },
      };
    }
  }

  /**
   * Verify SPF record
   */
  private async verifySPF(domain: string, hostIp: string): Promise<boolean> {
    try {
      const records = await dns.resolveTxt(domain);
      const txtRecords = records.flat();

      const spfRecord = txtRecords.find((record) => record.startsWith('v=spf1'));

      if (!spfRecord) {
        logger.warn({ domain }, 'No SPF record found');
        return false;
      }

      // Check if record contains Host IP and proper format
      const hasHostIp = spfRecord.includes(`ip4:${hostIp}`);
      const hasAfrisinc = spfRecord.includes('mail.afrisinc.com');

      if (!hasHostIp || !hasAfrisinc) {
        logger.warn({ domain, spfRecord }, 'SPF record missing required entries');
        return false;
      }

      logger.info({ domain }, 'SPF record verified');
      return true;
    } catch (error) {
      logger.warn({ error, domain }, 'SPF verification failed');
      return false;
    }
  }

  /**
   * Verify DKIM record
   */
  private async verifyDKIM(domain: string, publicKey: string, selector: string): Promise<boolean> {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const records = await dns.resolveTxt(dkimDomain);
      const txtRecords = records.flat().join('');

      // Check for DKIM record format and public key
      const hasDKIMVersion = txtRecords.includes('v=DKIM1');
      const hasPublicKey = txtRecords.includes(publicKey.substring(0, 30));

      if (!hasDKIMVersion || !hasPublicKey) {
        logger.warn({ domain, dkimDomain }, 'DKIM record missing required entries');
        return false;
      }

      logger.info({ domain }, 'DKIM record verified');
      return true;
    } catch (error) {
      logger.warn({ error, domain }, 'DKIM verification failed');
      return false;
    }
  }

  /**
   * Verify DMARC record
   */
  private async verifyDMARC(domain: string): Promise<boolean> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await dns.resolveTxt(dmarcDomain);
      const txtRecords = records.flat();

      const dmarcRecord = txtRecords.find((record) => record.startsWith('v=DMARC1'));

      if (!dmarcRecord) {
        logger.warn({ domain }, 'No DMARC record found');
        return false;
      }

      logger.info({ domain }, 'DMARC record verified');
      return true;
    } catch (error) {
      logger.warn({ error, domain }, 'DMARC verification failed');
      return false;
    }
  }

  /**
   * Get DNS records that customer needs to add
   */
  getDNSRecords(domain: string, publicKey: string, hostIp: string, selector: string = 'afrisinc'): DomainDNSRecord[] {
    return [
      {
        type: 'TXT',
        name: '@',
        value: `v=spf1 ip4:${hostIp} include:mail.afrisinc.com ~all`,
        label: 'SPF',
        purpose: 'Authorizes our server to send email on your behalf',
      },
      {
        type: 'TXT',
        name: `${selector}._domainkey`,
        value: `v=DKIM1; k=rsa; p=${publicKey}`,
        label: 'DKIM',
        purpose: 'Cryptographic signature proving email authenticity',
      },
      {
        type: 'TXT',
        name: '_dmarc',
        value: 'v=DMARC1; p=none; rua=mailto:dmarc@afrisinc.com',
        label: 'DMARC',
        purpose: 'Policy for handling failed authentication',
      },
    ];
  }
}

export const customDomainDNSService = new CustomDomainDNSService();

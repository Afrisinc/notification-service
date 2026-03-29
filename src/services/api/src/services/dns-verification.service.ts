import { promises as dns } from 'dns';
import { logger } from '../config/logger';

export interface DNSVerificationResult {
  domain: string;
  spf: {
    status: 'verified' | 'not_found' | 'invalid' | 'error';
    records: string[];
    message: string;
  };
  dkim: {
    status: 'verified' | 'not_found' | 'invalid' | 'error';
    records: string[];
    message: string;
  };
  dmarc: {
    status: 'verified' | 'not_found' | 'optional';
    records: string[];
    message: string;
  };
}

export class DNSVerificationService {
  /**
   * Verify DNS records for a domain
   * Checks SPF, DKIM, and DMARC records
   */
  static async verifyDomain(emailAddress: string): Promise<DNSVerificationResult> {
    try {
      const domain = emailAddress.split('@')[1];

      if (!domain) {
        throw new Error('Invalid email address format');
      }

      const [spfResult, dmarcResult] = await Promise.all([this.verifySPF(domain), this.verifyDMARC(domain)]);

      // DKIM verification is more complex as it requires a selector
      // For now, we'll provide a guide
      const dkimResult = {
        status: 'not_found' as const,
        records: [],
        message:
          'DKIM records require a selector (e.g., selector._domainkey.example.com). Check your email provider for the correct selector and DKIM public key.',
      };

      return {
        domain,
        spf: spfResult,
        dkim: dkimResult,
        dmarc: dmarcResult,
      };
    } catch (error) {
      logger.error({ error, emailAddress }, 'Failed to verify DNS records');
      throw error;
    }
  }

  /**
   * Verify SPF record
   */
  private static async verifySPF(domain: string): Promise<DNSVerificationResult['spf']> {
    try {
      const records = await dns.resolveTxt(domain);
      const txtRecords = records.flat();

      // Look for SPF record (starts with "v=spf1")
      const spfRecord = txtRecords.find((record) => record.startsWith('v=spf1'));

      if (!spfRecord) {
        return {
          status: 'not_found',
          records: txtRecords,
          message: 'No SPF record found. Add: v=spf1 include:sendgrid.net ~all',
        };
      }

      // Check if it includes a mail provider
      const hasProvider =
        spfRecord.includes('sendgrid.net') ||
        spfRecord.includes('gmail.com') ||
        spfRecord.includes('outlook.com') ||
        spfRecord.includes('amazonses.com') ||
        spfRecord.includes('mailgun.org');

      if (!hasProvider) {
        return {
          status: 'invalid',
          records: [spfRecord],
          message: `SPF record found but may not include your email provider. Current: ${spfRecord}`,
        };
      }

      return {
        status: 'verified',
        records: [spfRecord],
        message: 'SPF record is properly configured',
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOTFOUND')) {
        return {
          status: 'error',
          records: [],
          message: 'Domain not found in DNS. Check domain name.',
        };
      }

      return {
        status: 'not_found',
        records: [],
        message: 'Unable to verify SPF record. Check domain configuration.',
      };
    }
  }

  /**
   * Verify DMARC record
   */
  private static async verifyDMARC(domain: string): Promise<DNSVerificationResult['dmarc']> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await dns.resolveTxt(dmarcDomain);
      const txtRecords = records.flat();

      // Look for DMARC record (starts with "v=DMARC1")
      const dmarcRecord = txtRecords.find((record) => record.startsWith('v=DMARC1'));

      if (!dmarcRecord) {
        return {
          status: 'optional',
          records: txtRecords,
          message: 'No DMARC record found (optional but recommended)',
        };
      }

      return {
        status: 'verified',
        records: [dmarcRecord],
        message: 'DMARC policy is configured',
      };
    } catch (error) {
      return {
        status: 'optional',
        records: [],
        message: 'DMARC record not found (optional)',
      };
    }
  }
}

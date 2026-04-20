import { promisify } from 'util';
import { resolveTxt } from 'dns';
import { logger } from '../config/logger';

const resolveTxtAsync = promisify(resolveTxt);

export class DNSVerifyService {
  async verifySPF(domain: string): Promise<boolean> {
    try {
      const records = await resolveTxtAsync(domain);
      logger.info({ domain, recordCount: records.length }, 'SPF lookup succeeded');
      const spfRecord = records.find((record) => record.join('').includes('v=spf1'));
      return !!spfRecord;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ domain, error: msg }, 'SPF record lookup failed - may not be propagated yet');
      return false;
    }
  }

  async verifyDKIM(selector: string, domain: string): Promise<boolean> {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const records = await resolveTxtAsync(dkimDomain);
      logger.info({ dkimDomain, recordCount: records.length }, 'DKIM lookup succeeded');
      const dkimRecord = records.find((record) => record.join('').includes('v=DKIM1'));
      return !!dkimRecord;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ domain, selector, dkimDomain: `${selector}._domainkey.${domain}`, error: msg }, 'DKIM lookup failed');
      return false;
    }
  }

  async verifyDMARC(domain: string): Promise<boolean> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await resolveTxtAsync(dmarcDomain);
      logger.info({ dmarcDomain, recordCount: records.length }, 'DMARC lookup succeeded');
      const dmarcRecord = records.find((record) => record.join('').includes('v=DMARC1'));
      return !!dmarcRecord;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ domain, dmarcDomain: `_dmarc.${domain}`, error: msg }, 'DMARC lookup failed');
      return false;
    }
  }
}

export const dnsVerifyService = new DNSVerifyService();

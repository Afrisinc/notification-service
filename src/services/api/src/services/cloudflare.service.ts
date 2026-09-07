import axios, { AxiosError, AxiosInstance } from 'axios';
import psl from 'psl';
import { logger } from '../config/logger';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_RETRIES = 3;

export interface CloudflareDNSRecord {
  type: 'TXT';
  name: string;
  content: string;
}

export interface CloudflareConfigureResult {
  success: boolean;
  zoneId?: string;
  error?: string;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export class CloudflareService {
  private client(token: string): AxiosInstance {
    return axios.create({
      baseURL: CLOUDFLARE_API_BASE,
      timeout: 10000,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }

  /**
   * Resolve the registrable root domain (e.g. "mail.acme.co.uk" -> "acme.co.uk")
   * since a Cloudflare zone is always registered at the root, not a subdomain.
   */
  private getRootDomain(domain: string): string {
    const parsed = psl.parse(domain);
    if ('domain' in parsed && parsed.domain) {
      return parsed.domain;
    }
    return domain;
  }

  async findZoneId(token: string, domain: string): Promise<string | null> {
    const root = this.getRootDomain(domain);
    const client = this.client(token);
    const result = await this.request<Array<{ id: string; name: string }>>(
      () => client.get('/zones', { params: { name: root } }),
      `find zone for ${root}`
    );
    return result[0]?.id ?? null;
  }

  async upsertTxtRecord(token: string, zoneId: string, name: string, content: string): Promise<void> {
    const client = this.client(token);
    const existing = await this.request<Array<{ id: string }>>(
      () => client.get(`/zones/${zoneId}/dns_records`, { params: { type: 'TXT', name } }),
      `look up TXT record ${name}`
    );

    const body = { type: 'TXT', name, content, ttl: 1 };

    if (existing[0]) {
      await this.request(
        () => client.put(`/zones/${zoneId}/dns_records/${existing[0].id}`, body),
        `update TXT record ${name}`
      );
    } else {
      await this.request(() => client.post(`/zones/${zoneId}/dns_records`, body), `create TXT record ${name}`);
    }
  }

  /**
   * Auto-provision every SPF/DKIM/DMARC TXT record for a domain in one call.
   * Never throws - callers should fall back to the manual-DNS UI on failure.
   */
  async configureDomainRecords(
    token: string,
    domain: string,
    records: CloudflareDNSRecord[]
  ): Promise<CloudflareConfigureResult> {
    try {
      const zoneId = await this.findZoneId(token, domain);
      if (!zoneId) {
        return {
          success: false,
          error: `No Cloudflare zone found for "${this.getRootDomain(domain)}". Make sure the domain is added to your Cloudflare account and the API token has access to it.`,
        };
      }

      for (const record of records) {
        await this.upsertTxtRecord(token, zoneId, record.name, record.content);
      }

      return { success: true, zoneId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Cloudflare API error';
      logger.error({ error: message, domain }, 'Failed to auto-configure DNS records via Cloudflare');
      return { success: false, error: message };
    }
  }

  private async request<T>(fn: () => Promise<{ data: CloudflareEnvelope<T> }>, operation: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fn();

        if (!response.data.success) {
          const message = response.data.errors?.[0]?.message || `Cloudflare API call failed: ${operation}`;
          throw new Error(message);
        }

        return response.data.result;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError<CloudflareEnvelope<unknown>>;
        const status = axiosError?.response?.status;

        if (status && status >= 400 && status < 500 && status !== 429) {
          const apiMessage = axiosError.response?.data?.errors?.[0]?.message;
          throw new Error(
            apiMessage || (error instanceof Error ? error.message : `Cloudflare API request failed: ${operation}`)
          );
        }

        logger.warn(
          { attempt, operation, error: error instanceof Error ? error.message : String(error) },
          'Cloudflare API request failed, retrying'
        );

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 200 * Math.pow(2, attempt - 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Cloudflare API request failed: ${operation}`);
  }
}

export const cloudflareService = new CloudflareService();

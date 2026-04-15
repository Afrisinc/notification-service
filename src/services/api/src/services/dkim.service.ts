import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../config/logger';

interface DKIMKeyPair {
  publicKey: string;
  privateKeyPath: string;
}

export class DKIMService {
  private readonly OPENDKIM_KEYS_DIR = '/etc/opendkim/keys';
  private readonly SIGNING_TABLE_PATH = '/etc/opendkim/signing.table';
  private readonly KEY_TABLE_PATH = '/etc/opendkim/key.table';

  /**
   * Generate a 2048-bit DKIM key pair for a domain
   * Returns the public key and path to the private key
   */
  async generateKeyPair(domain: string, selector: string = 'afrisinc'): Promise<DKIMKeyPair> {
    try {
      const domainKeyDir = join(this.OPENDKIM_KEYS_DIR, domain);

      // Create directory
      try {
        mkdirSync(domainKeyDir, { recursive: true });
      } catch (err) {
        // Directory may already exist, continue
      }

      // Generate keys using opendkim-genkey
      const cmd = `opendkim-genkey -b 2048 -d ${domain} -D ${domainKeyDir} -s ${selector} -v`;

      try {
        execSync(cmd, { stdio: 'pipe' });
      } catch (error) {
        logger.error({ error, domain, cmd }, 'Failed to generate DKIM keys');
        throw new Error(`DKIM key generation failed for domain ${domain}`);
      }

      // Change ownership to opendkim user
      try {
        execSync(`chown -R opendkim:opendkim ${domainKeyDir}`);
      } catch (error) {
        logger.warn({ error }, 'Failed to change ownership to opendkim user');
      }

      // Read the public key from the generated .txt file
      const publicKeyPath = join(domainKeyDir, `${selector}.txt`);
      const publicKeyContent = readFileSync(publicKeyPath, 'utf-8');

      // Extract the p= value from the public key
      const publicKey = this.extractPublicKey(publicKeyContent);

      // Private key path for storage in database
      const privateKeyPath = join(domainKeyDir, `${selector}.private`);

      return {
        publicKey,
        privateKeyPath,
      };
    } catch (error) {
      logger.error({ error, domain }, 'DKIM key generation error');
      throw error;
    }
  }

  /**
   * Extract the p= value from OpenDKIM public key file
   */
  private extractPublicKey(keyContent: string): string {
    const match = keyContent.match(/p=([^;]+)/);
    if (!match || !match[1]) {
      throw new Error('Failed to extract public key from DKIM key file');
    }
    return match[1].trim();
  }

  /**
   * Add domain to OpenDKIM signing table
   */
  async addToSigningTable(domain: string, selector: string, privateKeyPath: string): Promise<void> {
    try {
      // Read current signing table
      let content = '';
      try {
        content = readFileSync(this.SIGNING_TABLE_PATH, 'utf-8');
      } catch (error) {
        // File may not exist, continue with empty content
        logger.info('Signing table does not exist, creating new');
      }

      // Check if domain already exists in the file
      const domainPattern = new RegExp(`^\\*@${domain.replace(/\./g, '\\.')}\\s`, 'm');
      if (domainPattern.test(content)) {
        logger.info({ domain }, 'Domain already in signing table');
        return;
      }

      // Append new entry
      const entry = `*@${domain}    ${domain}:${selector}:${privateKeyPath}\n`;
      writeFileSync(this.SIGNING_TABLE_PATH, content + entry);

      logger.info({ domain }, 'Added domain to signing table');
    } catch (error) {
      logger.error({ error, domain }, 'Failed to add domain to signing table');
      throw error;
    }
  }

  /**
   * Add domain to OpenDKIM key table
   */
  async addToKeyTable(domain: string, selector: string, privateKeyPath: string): Promise<void> {
    try {
      // Read current key table
      let content = '';
      try {
        content = readFileSync(this.KEY_TABLE_PATH, 'utf-8');
      } catch (error) {
        // File may not exist, continue
        logger.info('Key table does not exist, creating new');
      }

      // Check if domain already exists
      const domainKeyPattern = new RegExp(`^${domain.replace(/\./g, '\\.')}:${selector}\\s`, 'm');
      if (domainKeyPattern.test(content)) {
        logger.info({ domain }, 'Domain already in key table');
        return;
      }

      // Append new entry
      const entry = `${domain}:${selector}    ${domain}:${selector}:${privateKeyPath}\n`;
      writeFileSync(this.KEY_TABLE_PATH, content + entry);

      logger.info({ domain }, 'Added domain to key table');
    } catch (error) {
      logger.error({ error, domain }, 'Failed to add domain to key table');
      throw error;
    }
  }

  /**
   * Remove domain from OpenDKIM signing and key tables
   */
  async removeFromDKIMTables(domain: string, selector: string = 'afrisinc'): Promise<void> {
    try {
      // Remove from signing table
      try {
        let signingContent = readFileSync(this.SIGNING_TABLE_PATH, 'utf-8');
        const domainPattern = new RegExp(`^\\*@${domain.replace(/\./g, '\\.')}.*\n?`, 'm');
        signingContent = signingContent.replace(domainPattern, '');
        writeFileSync(this.SIGNING_TABLE_PATH, signingContent);
        logger.info({ domain }, 'Removed domain from signing table');
      } catch (error) {
        logger.warn({ error, domain }, 'Failed to remove from signing table');
      }

      // Remove from key table
      try {
        let keyContent = readFileSync(this.KEY_TABLE_PATH, 'utf-8');
        const keyPattern = new RegExp(`^${domain.replace(/\./g, '\\.')}:${selector}.*\n?`, 'm');
        keyContent = keyContent.replace(keyPattern, '');
        writeFileSync(this.KEY_TABLE_PATH, keyContent);
        logger.info({ domain }, 'Removed domain from key table');
      } catch (error) {
        logger.warn({ error, domain }, 'Failed to remove from key table');
      }
    } catch (error) {
      logger.error({ error, domain }, 'Failed to remove domain from DKIM tables');
      throw error;
    }
  }

  /**
   * Reload OpenDKIM service
   */
  async reloadOpenDKIM(): Promise<void> {
    try {
      execSync('systemctl reload opendkim', { stdio: 'pipe' });
      logger.info('OpenDKIM reloaded successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to reload OpenDKIM');
      throw new Error('Failed to reload OpenDKIM service');
    }
  }

  /**
   * Delete DKIM keys from server
   */
  async deleteKeys(domain: string): Promise<void> {
    try {
      const domainKeyDir = join(this.OPENDKIM_KEYS_DIR, domain);
      execSync(`rm -rf ${domainKeyDir}`);
      logger.info({ domain }, 'DKIM keys deleted');
    } catch (error) {
      logger.error({ error, domain }, 'Failed to delete DKIM keys');
      throw error;
    }
  }
}

export const dkimService = new DKIMService();

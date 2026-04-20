// @ts-expect-error ssh2 has no TypeScript definitions
import { Client as SSHClient } from 'ssh2';
import path from 'path';
import fs from 'fs';
import { logger } from '../config/logger';
import { getConfig } from '@shared/config';

const OPENDKIM_KEYS_DIR = '/etc/opendkim/keys';
const SIGNING_TABLE = '/etc/opendkim/signing.table';
const KEYS_TABLE = '/etc/opendkim/keys.table';

export class DKIMService {
  private async executeRemoteCommand(command: string): Promise<string> {
    const config = getConfig();
    const { MAIL_SERVER_HOST, MAIL_SERVER_PORT, MAIL_SERVER_USER, MAIL_SERVER_SSH_KEY, MAIL_SERVER_SSH_PASSWORD } =
      config;

    if (!MAIL_SERVER_HOST) {
      throw new Error('MAIL_SERVER_HOST not configured');
    }

    return new Promise((resolve, reject) => {
      const conn = new SSHClient();

      conn.on('ready', () => {
        conn.exec(command, (err: any, stream: any) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('close', (code: number) => {
            conn.end();
            if (code === 0) {
              resolve(stdout);
            } else {
              reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
            }
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', reject);

      const sshConfig: any = {
        host: MAIL_SERVER_HOST,
        port: MAIL_SERVER_PORT || 22,
        username: MAIL_SERVER_USER || 'root',
      };

      if (MAIL_SERVER_SSH_KEY) {
        sshConfig.privateKey = fs.readFileSync(MAIL_SERVER_SSH_KEY);
      } else if (MAIL_SERVER_SSH_PASSWORD) {
        sshConfig.password = MAIL_SERVER_SSH_PASSWORD;
      } else {
        reject(new Error('SSH authentication not configured'));
        return;
      }

      conn.connect(sshConfig);
    });
  }

  async generateKeyPair(
    domain: string,
    selector: string = 'default'
  ): Promise<{ publicKey: string; privateKeyPath: string }> {
    try {
      const domainDir = path.posix.join(OPENDKIM_KEYS_DIR, domain);
      const privateKeyPath = path.posix.join(domainDir, `${selector}.private`);

      await this.executeRemoteCommand(`sudo mkdir -p ${domainDir}`);
      await this.executeRemoteCommand(`sudo opendkim-genkey -b 2048 -d ${domain} -s ${selector} -D ${domainDir}`);

      try {
        await this.executeRemoteCommand(`sudo chown -R opendkim:opendkim ${domainDir}`);
        await this.executeRemoteCommand(`sudo chmod -R 770 ${domainDir}`);
      } catch (chownError) {
        logger.warn({ domain }, 'Could not change directory ownership');
      }

      logger.info({ domain, selector }, 'DKIM key pair generated via SSH');

      const publicKeyPath = path.posix.join(domainDir, `${selector}.txt`);
      const publicKeyContent = await this.executeRemoteCommand(`sudo cat ${publicKeyPath}`);

      logger.debug({ contentLength: publicKeyContent.length }, 'Raw public key file content');

      // Extract clean DKIM record: v=DKIM1; ... p=<key>
      // Zone file format: afrisinc._domainkey IN TXT ( "v=DKIM1..." "p=..." ) ; comment
      // Extract just the content between quotes, removing tabs and line breaks
      const publicKey = publicKeyContent
        .replace(/.*\(\s*/g, '') // Remove opening parenthesis
        .replace(/\s*\).*$/g, '') // Remove closing parenthesis and comment
        .replace(/"\s*"/g, '') // Remove quote separators
        .replace(/"/g, '') // Remove all quotes
        .replace(/\t/g, '') // Remove tabs
        .replace(/\n/g, '') // Remove newlines
        .trim();

      logger.info({ domain, selector, keyLength: publicKey.length }, 'Public key extracted');

      if (!publicKey || !publicKey.includes('v=DKIM1')) {
        throw new Error(`Failed to extract valid DKIM key (got: ${publicKey.substring(0, 50)}...)`);
      }

      return { publicKey, privateKeyPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, domain, selector }, 'Failed to generate DKIM keys');
      throw new Error(`DKIM key generation failed: ${errorMessage}`);
    }
  }

  async addToSigningTable(domain: string): Promise<void> {
    try {
      const entry = `*@${domain} ${domain}`;
      const checkCmd = `sudo grep -q "*@${domain}" ${SIGNING_TABLE} 2>/dev/null && echo exists || echo not_exists`;
      const result = await this.executeRemoteCommand(checkCmd);

      if (result.includes('exists')) {
        logger.debug({ domain }, 'Domain already in signing table');
        return;
      }

      await this.executeRemoteCommand(`echo '${entry}' | sudo tee -a ${SIGNING_TABLE}`);
      logger.info({ domain }, 'Domain added to signing table');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, domain }, 'Failed to add to signing table');
      throw new Error(`Could not add to signing table: ${errorMessage}`);
    }
  }

  async addToKeysTable(domain: string, selector: string = 'default'): Promise<void> {
    try {
      const entry = `${domain} ${domain}:${selector}:/etc/opendkim/keys/${domain}/${selector}.private`;
      const checkCmd = `sudo grep -q "${domain}" ${KEYS_TABLE} 2>/dev/null && echo exists || echo not_exists`;
      const result = await this.executeRemoteCommand(checkCmd);

      if (result.includes('exists')) {
        logger.debug({ domain }, 'Domain already in keys table');
        return;
      }

      await this.executeRemoteCommand(`echo '${entry}' | sudo tee -a ${KEYS_TABLE}`);
      logger.info({ domain }, 'Domain added to keys table');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, domain }, 'Failed to add to keys table');
      throw new Error(`Could not add to keys table: ${errorMessage}`);
    }
  }

  async reloadOpenDKIM(): Promise<void> {
    try {
      await this.executeRemoteCommand('sudo systemctl reload opendkim');
      logger.info('OpenDKIM reloaded successfully');
    } catch (error) {
      logger.warn({ error }, 'OpenDKIM reload failed');
    }
  }

  async removeFromDKIMTables(domain: string): Promise<void> {
    try {
      await this.executeRemoteCommand(`sudo sed -i '/*@${domain}/d' ${SIGNING_TABLE} 2>/dev/null || true`);
      await this.executeRemoteCommand(`sudo sed -i '/${domain}/d' ${KEYS_TABLE} 2>/dev/null || true`);
      logger.info({ domain }, 'Domain removed from OpenDKIM tables');
    } catch (error) {
      logger.warn({ domain }, 'Failed to remove from OpenDKIM tables');
    }
  }

  async deleteKeys(domain: string): Promise<void> {
    try {
      const domainDir = path.posix.join(OPENDKIM_KEYS_DIR, domain);
      await this.executeRemoteCommand(`sudo rm -rf ${domainDir}`);
      logger.info({ domain }, 'DKIM keys deleted');
    } catch (error) {
      logger.warn({ domain }, 'Failed to delete keys');
    }
  }

  async getPublicKey(domain: string, selector: string = 'default'): Promise<string | null> {
    try {
      const publicKeyPath = path.posix.join(OPENDKIM_KEYS_DIR, domain, `${selector}.txt`);
      return await this.executeRemoteCommand(`sudo cat ${publicKeyPath}`);
    } catch {
      return null;
    }
  }

  async getPrivateKey(domain: string, selector: string = 'default'): Promise<{ key: string | null; error?: string }> {
    try {
      const privateKeyPath = path.posix.join(OPENDKIM_KEYS_DIR, domain, `${selector}.private`);
      logger.debug({ domain, selector, path: privateKeyPath }, 'Fetching private key');
      const key = await this.executeRemoteCommand(`sudo cat ${privateKeyPath}`);
      logger.info({ domain, selector }, 'Private key fetched successfully');
      return { key };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ domain, selector, error: errorMsg }, 'Failed to fetch private key');
      return { key: null, error: errorMsg };
    }
  }
}

export const dkimService = new DKIMService();

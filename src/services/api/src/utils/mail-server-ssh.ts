// @ts-expect-error ssh2 has no TypeScript definitions
import { Client as SSHClient } from 'ssh2';
import fs from 'fs';
import { getConfig } from '@shared/config';

/**
 * Runs a shell command on the mail server over SSH. Shared by any service
 * that needs to read or edit mail server config (OpenDKIM, Postfix, ...).
 * Callers are responsible for shell-quoting any interpolated values.
 */
export async function executeMailServerCommand(command: string): Promise<string> {
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

/** Single-quotes a value for safe interpolation into a remote shell command. */
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

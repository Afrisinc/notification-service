import { logger } from '../config/logger';
import { executeMailServerCommand, shQuote } from '../utils/mail-server-ssh';

const VIRTUAL_FILE = '/etc/postfix/virtual';
const ALIAS_DOMAIN = 'afrisinc.com';

// Local part of a virtual alias: same charset Postfix/RFC5322 local-parts allow, no whitespace.
const LOCAL_PART_RE = /^[a-zA-Z0-9._+-]+$/;
const EMAIL_RE = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface MailAlias {
  address: string;
  localPart: string;
  destinations: string[];
}

function parseVirtualFile(raw: string): MailAlias[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [address, ...rest] = line.split(/\s+/);
      const destinations = rest
        .join(' ')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      return {
        address,
        localPart: address.split('@')[0],
        destinations,
      };
    });
}

function serializeVirtualFile(aliases: MailAlias[]): string {
  return aliases.map((a) => `${a.address}\t${a.destinations.join(', ')}`).join('\n') + '\n';
}

function assertValidLocalPart(localPart: string) {
  if (!LOCAL_PART_RE.test(localPart)) {
    throw new Error('Invalid local part: only letters, digits, "._+-" are allowed');
  }
}

function assertValidDestinations(destinations: string[]) {
  if (destinations.length === 0) {
    throw new Error('At least one destination address is required');
  }
  for (const dest of destinations) {
    if (!EMAIL_RE.test(dest)) {
      throw new Error(`Invalid destination address: ${dest}`);
    }
  }
}

async function readAliases(): Promise<MailAlias[]> {
  const raw = await executeMailServerCommand(`sudo cat ${VIRTUAL_FILE}`);
  return parseVirtualFile(raw);
}

async function writeAliases(aliases: MailAlias[]): Promise<void> {
  const content = serializeVirtualFile(aliases);
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  await executeMailServerCommand(`echo ${shQuote(encoded)} | base64 -d | sudo tee ${VIRTUAL_FILE} > /dev/null`);
  await executeMailServerCommand(`sudo postmap ${VIRTUAL_FILE}`);
  await executeMailServerCommand('sudo systemctl reload postfix');
}

export class MailAliasService {
  async listAliases(): Promise<MailAlias[]> {
    return readAliases();
  }

  async addAlias(localPart: string, destinations: string[]): Promise<MailAlias> {
    assertValidLocalPart(localPart);
    assertValidDestinations(destinations);

    const address = `${localPart}@${ALIAS_DOMAIN}`;
    const aliases = await readAliases();

    if (aliases.some((a) => a.address === address)) {
      throw new Error(`Alias ${address} already exists`);
    }

    const alias: MailAlias = { address, localPart, destinations };
    aliases.push(alias);
    await writeAliases(aliases);

    logger.info({ address, destinations }, 'Mail alias added');
    return alias;
  }

  async updateAlias(localPart: string, destinations: string[]): Promise<MailAlias> {
    assertValidLocalPart(localPart);
    assertValidDestinations(destinations);

    const address = `${localPart}@${ALIAS_DOMAIN}`;
    const aliases = await readAliases();
    const existing = aliases.find((a) => a.address === address);

    if (!existing) {
      throw new Error(`Alias ${address} not found`);
    }

    existing.destinations = destinations;
    await writeAliases(aliases);

    logger.info({ address, destinations }, 'Mail alias updated');
    return existing;
  }

  async deleteAlias(localPart: string): Promise<void> {
    assertValidLocalPart(localPart);

    const address = `${localPart}@${ALIAS_DOMAIN}`;
    const aliases = await readAliases();
    const remaining = aliases.filter((a) => a.address !== address);

    if (remaining.length === aliases.length) {
      throw new Error(`Alias ${address} not found`);
    }

    await writeAliases(remaining);
    logger.info({ address }, 'Mail alias deleted');
  }
}

export const mailAliasService = new MailAliasService();

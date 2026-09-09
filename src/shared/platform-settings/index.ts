import { prismaRead, prismaWrite } from '@shared/database';
import { getOrSetCache, invalidateCache } from '@shared/cache';

const CACHE_KEY = 'cache:platform-email-settings';
const CACHE_TTL_SECONDS = 300;
const ROW_ID = 'default';

export interface PlatformEmailSettings {
  fromEmail: string;
  fromName: string;
  supportEmail: string | null;
}

function envDefaults(): PlatformEmailSettings {
  return {
    fromEmail: process.env.FROM_EMAIL || 'noreply@afrisinc.com',
    fromName: process.env.COMPANY_NAME || 'Afrisinc',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@afrisinc.com',
  };
}

/**
 * The platform-wide default sender identity, used whenever an app has no
 * custom email provider configured. Lazily created from env-var defaults on
 * first read, so behavior is unchanged until an admin edits it via the
 * dashboard.
 */
export async function getPlatformEmailSettings(): Promise<PlatformEmailSettings> {
  try {
    return await getOrSetCache(CACHE_KEY, CACHE_TTL_SECONDS, async () => {
      const row = await prismaRead.platformEmailSettings.findUnique({ where: { id: ROW_ID } });

      if (row) {
        return { fromEmail: row.from_email, fromName: row.from_name, supportEmail: row.support_email };
      }

      const defaults = envDefaults();
      const created = await prismaWrite.platformEmailSettings.upsert({
        where: { id: ROW_ID },
        update: {},
        create: {
          id: ROW_ID,
          from_email: defaults.fromEmail,
          from_name: defaults.fromName,
          support_email: defaults.supportEmail,
        },
      });

      return { fromEmail: created.from_email, fromName: created.from_name, supportEmail: created.support_email };
    });
  } catch (err) {
    // Never let a DB/cache hiccup block an email send - fall back to env defaults.
    console.error(
      'Failed to load platform email settings, falling back to env defaults:',
      err instanceof Error ? err.message : err
    );
    return envDefaults();
  }
}

export async function updatePlatformEmailSettings(data: {
  fromEmail: string;
  fromName: string;
  supportEmail?: string | null;
}): Promise<PlatformEmailSettings> {
  const updated = await prismaWrite.platformEmailSettings.upsert({
    where: { id: ROW_ID },
    update: { from_email: data.fromEmail, from_name: data.fromName, support_email: data.supportEmail ?? null },
    create: {
      id: ROW_ID,
      from_email: data.fromEmail,
      from_name: data.fromName,
      support_email: data.supportEmail ?? null,
    },
  });

  await invalidateCache(CACHE_KEY);

  return { fromEmail: updated.from_email, fromName: updated.from_name, supportEmail: updated.support_email };
}

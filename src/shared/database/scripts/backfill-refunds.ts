import { prismaRead } from '../config/prisma';
import { refundFailedNotification } from '../../billing/payg-refund';

const APPLY = process.argv.includes('--apply');

interface Candidate {
  id: string;
  account_id: string;
  channel: string;
  owed: number;
}

async function findCandidates(): Promise<Candidate[]> {
  return prismaRead.$queryRawUnsafe<Candidate[]>(`
    SELECT n.id, n.account_id, n.channel::text AS channel, ABS(ded.amount) AS owed
    FROM notifications n
    JOIN credit_transactions ded ON ded.notification_id = n.id AND ded.type = 'deduction'
    LEFT JOIN credit_transactions ref ON ref.notification_id = n.id AND ref.type = 'refund'
    WHERE n.status = 'FAILED' AND ref.id IS NULL
    ORDER BY n."createdAt" ASC
  `);
}

async function main() {
  const candidates = await findCandidates();

  if (candidates.length === 0) {
    console.log('No unrefunded FAILED notifications found. Nothing to do.');
    await prismaRead.$disconnect();
    return;
  }

  const totalOwed = candidates.reduce((sum, c) => sum + Number(c.owed), 0);
  const byAccount = new Map<string, { count: number; owed: number }>();
  for (const c of candidates) {
    const entry = byAccount.get(c.account_id) || { count: 0, owed: 0 };
    entry.count += 1;
    entry.owed += Number(c.owed);
    byAccount.set(c.account_id, entry);
  }

  console.log(`Found ${candidates.length} unrefunded FAILED notifications, totalling $${totalOwed.toFixed(6)}`);
  console.table(
    Array.from(byAccount.entries()).map(([account_id, v]) => ({
      account_id,
      failed_count: v.count,
      owed_usd: v.owed.toFixed(6),
    }))
  );

  if (!APPLY) {
    console.log('\nDry run only — no refunds applied. Re-run with --apply to actually credit accounts back.');
    await prismaRead.$disconnect();
    return;
  }

  console.log('\nApplying refunds...');
  let refunded = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await refundFailedNotification(candidate.id, 'Backfill: SMS/notification failed permanently');
      if (result.refunded) {
        refunded++;
        console.log(`refunded ${candidate.id} account=${candidate.account_id} amount=${result.amount}`);
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;
      console.error(`FAILED to refund ${candidate.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nDone. refunded=${refunded} skipped=${skipped} failed=${failed}`);
  await prismaRead.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

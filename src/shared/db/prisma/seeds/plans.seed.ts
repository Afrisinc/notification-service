import { PrismaClient } from '@prisma/client';

const PLAN_LIMITS = {
  FREE: {
    emails_per_month: 1000,
    sms_per_month: 0,
    api_calls_per_month: 10000,
    contacts: 500,
    templates: 5,
    apps: 1,
    team_members: 1,
    api_keys: 1,
    campaigns: 2,
    retention_days: 30,
    webhooks: 1,
    custom_domain: false,
    advanced_analytics: false,
  },
  PRO: {
    emails_per_month: 100000,
    sms_per_month: 10000,
    api_calls_per_month: 1000000,
    contacts: 100000,
    templates: null, // unlimited
    apps: 10,
    team_members: 5,
    api_keys: 10,
    campaigns: 50,
    retention_days: 90,
    webhooks: 10,
    custom_domain: true,
    advanced_analytics: true,
  },
  ENTERPRISE: {
    emails_per_month: null, // unlimited
    sms_per_month: null,
    api_calls_per_month: null,
    contacts: null,
    templates: null,
    apps: null,
    team_members: null,
    api_keys: null,
    campaigns: null,
    retention_days: 365,
    webhooks: null,
    custom_domain: true,
    advanced_analytics: true,
  },
};

export async function seedPlanLimits(prisma: PrismaClient) {
  try {
    const plans = await prisma.plan.findMany();

    for (const plan of plans) {
      const limits = PLAN_LIMITS[plan.name as keyof typeof PLAN_LIMITS];

      if (!limits) continue;

      for (const [metric, value] of Object.entries(limits)) {
        // Skip booleans for now - handle separately if needed
        if (typeof value === 'boolean') continue;

        await prisma.planLimit.upsert({
          where: { plan_id_metric: { plan_id: plan.id, metric } },
          update: { limit_value: value === null ? -1 : value }, // -1 = unlimited
          create: {
            plan_id: plan.id,
            metric,
            limit_value: value === null ? -1 : value,
            period: metric.includes('month') ? 'monthly' : metric.includes('year') ? 'yearly' : 'daily',
          },
        });
      }
    }

    console.log('✅ Plan limits seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed plan limits:', error);
    throw error;
  }
}

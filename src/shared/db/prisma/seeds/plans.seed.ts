import { PrismaClient } from '@prisma/client';

/**
 * Canonical plan definitions — source of truth is the Pricing page.
 * All prices are USD. limit_value of -1 means unlimited.
 * Boolean features are stored as limit_value 0 (false) or 1 (true).
 * period: 'monthly' | 'static' (static = not time-bound, e.g. contacts/apps cap)
 */

interface PlanDef {
  name: string;
  price_monthly: number;
  price_yearly: number; // monthly equivalent when billed annually
  limits: Array<{ metric: string; limit_value: number; period: string }>;
}

const PLANS: PlanDef[] = [
  // ──────────────────────────────────────────────────────────
  // FREE  $0 / mo  —  email only, no API
  // ──────────────────────────────────────────────────────────
  {
    name: 'FREE',
    price_monthly: 0,
    price_yearly: 0,
    limits: [
      { metric: 'emails_per_month', limit_value: 500, period: 'monthly' },
      { metric: 'sms_per_month', limit_value: 0, period: 'monthly' },
      { metric: 'push_subscribers', limit_value: 0, period: 'static' },
      { metric: 'in_app_per_month', limit_value: 0, period: 'monthly' },
      { metric: 'apps', limit_value: 1, period: 'static' },
      { metric: 'contacts', limit_value: 200, period: 'static' },
      { metric: 'templates', limit_value: 3, period: 'static' },
      { metric: 'campaigns', limit_value: 2, period: 'static' },
      { metric: 'team_members', limit_value: 1, period: 'static' },
      { metric: 'api_keys', limit_value: 0, period: 'static' },
      { metric: 'webhooks', limit_value: 0, period: 'static' },
      { metric: 'custom_domain', limit_value: 0, period: 'static' }, // false
      { metric: 'advanced_analytics', limit_value: 0, period: 'static' }, // false
      { metric: 'a_b_testing', limit_value: 0, period: 'static' }, // false
      { metric: 'api_access', limit_value: 0, period: 'static' }, // false
      { metric: 'dedicated_ip', limit_value: 0, period: 'static' }, // false
      { metric: 'uptime_sla', limit_value: 0, period: 'static' }, // false
      { metric: 'sso', limit_value: 0, period: 'static' }, // false
      { metric: 'retention_days', limit_value: 30, period: 'static' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // STARTER  $19/mo  ($15/mo billed annually = $182/yr)
  // All channels unlocked — best entry point
  // ──────────────────────────────────────────────────────────
  {
    name: 'STARTER',
    price_monthly: 19,
    price_yearly: 15,
    limits: [
      { metric: 'emails_per_month', limit_value: 50000, period: 'monthly' },
      { metric: 'sms_per_month', limit_value: 300, period: 'monthly' },
      { metric: 'push_subscribers', limit_value: 15000, period: 'static' },
      { metric: 'in_app_per_month', limit_value: 30000, period: 'monthly' },
      { metric: 'apps', limit_value: 3, period: 'static' },
      { metric: 'contacts', limit_value: 10000, period: 'static' },
      { metric: 'templates', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'campaigns', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'team_members', limit_value: 3, period: 'static' },
      { metric: 'api_keys', limit_value: 5, period: 'static' },
      { metric: 'webhooks', limit_value: 3, period: 'static' },
      { metric: 'custom_domain', limit_value: 1, period: 'static' }, // 1 domain
      { metric: 'advanced_analytics', limit_value: 0, period: 'static' }, // false
      { metric: 'a_b_testing', limit_value: 0, period: 'static' }, // false
      { metric: 'api_access', limit_value: 1, period: 'static' }, // true
      { metric: 'dedicated_ip', limit_value: 0, period: 'static' }, // false
      { metric: 'uptime_sla', limit_value: 0, period: 'static' }, // false
      { metric: 'sso', limit_value: 0, period: 'static' }, // false
      { metric: 'retention_days', limit_value: 60, period: 'static' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // SCALE  $69/mo  ($55/mo billed annually = $662/yr)
  // For fast-growing businesses
  // ──────────────────────────────────────────────────────────
  {
    name: 'SCALE',
    price_monthly: 69,
    price_yearly: 55,
    limits: [
      { metric: 'emails_per_month', limit_value: 500000, period: 'monthly' },
      { metric: 'sms_per_month', limit_value: 2000, period: 'monthly' },
      { metric: 'push_subscribers', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'in_app_per_month', limit_value: -1, period: 'monthly' }, // unlimited
      { metric: 'apps', limit_value: 10, period: 'static' },
      { metric: 'contacts', limit_value: 100000, period: 'static' },
      { metric: 'templates', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'campaigns', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'team_members', limit_value: 20, period: 'static' },
      { metric: 'api_keys', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'webhooks', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'custom_domain', limit_value: 10, period: 'static' }, // 10 domains
      { metric: 'advanced_analytics', limit_value: 1, period: 'static' }, // true
      { metric: 'a_b_testing', limit_value: 1, period: 'static' }, // true
      { metric: 'api_access', limit_value: 1, period: 'static' }, // true
      { metric: 'dedicated_ip', limit_value: 1, period: 'static' }, // true
      { metric: 'uptime_sla', limit_value: 0, period: 'static' }, // false
      { metric: 'sso', limit_value: 0, period: 'static' }, // false
      { metric: 'retention_days', limit_value: 365, period: 'static' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // ENTERPRISE  Custom pricing (starts $199/mo)
  // Large operations — SSO, 99.9% SLA, Africa data residency
  // ──────────────────────────────────────────────────────────
  {
    name: 'ENTERPRISE',
    price_monthly: 199,
    price_yearly: 199,
    limits: [
      { metric: 'emails_per_month', limit_value: -1, period: 'monthly' }, // unlimited
      { metric: 'sms_per_month', limit_value: -1, period: 'monthly' }, // negotiated → unlimited
      { metric: 'push_subscribers', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'in_app_per_month', limit_value: -1, period: 'monthly' }, // unlimited
      { metric: 'apps', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'contacts', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'templates', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'campaigns', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'team_members', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'api_keys', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'webhooks', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'custom_domain', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'advanced_analytics', limit_value: 1, period: 'static' }, // true
      { metric: 'a_b_testing', limit_value: 1, period: 'static' }, // true
      { metric: 'api_access', limit_value: 1, period: 'static' }, // true
      { metric: 'dedicated_ip', limit_value: 1, period: 'static' }, // true
      { metric: 'uptime_sla', limit_value: 1, period: 'static' }, // true — 99.9%
      { metric: 'sso', limit_value: 1, period: 'static' }, // true — SSO/SAML/LDAP
      { metric: 'africa_data_residency', limit_value: 1, period: 'static' }, // true
      { metric: 'dedicated_account_manager', limit_value: 1, period: 'static' }, // true
      { metric: 'retention_days', limit_value: 730, period: 'static' }, // custom (2yr)
    ],
  },

  // ──────────────────────────────────────────────────────────
  // PAYG  No subscription — top up credits, pay per message
  // Rates: Email $0.0008 | SMS $0.035 | Push $0.00005 | In-App $0.00004
  // Credits never expire. Bonus on bulk top-ups.
  // ──────────────────────────────────────────────────────────
  {
    name: 'PAYG',
    price_monthly: 0,
    price_yearly: 0,
    limits: [
      // channels are -1 (unlimited) — deducted from credit balance at send time
      { metric: 'emails_per_month', limit_value: -1, period: 'monthly' },
      { metric: 'sms_per_month', limit_value: -1, period: 'monthly' },
      { metric: 'push_subscribers', limit_value: -1, period: 'static' },
      { metric: 'in_app_per_month', limit_value: -1, period: 'monthly' },
      // entity caps
      { metric: 'apps', limit_value: 1, period: 'static' },
      { metric: 'contacts', limit_value: 1000, period: 'static' },
      { metric: 'templates', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'campaigns', limit_value: -1, period: 'static' }, // unlimited
      { metric: 'team_members', limit_value: 1, period: 'static' },
      { metric: 'api_keys', limit_value: 3, period: 'static' },
      { metric: 'webhooks', limit_value: 1, period: 'static' },
      // features
      { metric: 'custom_domain', limit_value: 0, period: 'static' }, // false
      { metric: 'advanced_analytics', limit_value: 0, period: 'static' }, // false
      { metric: 'a_b_testing', limit_value: 0, period: 'static' }, // false
      { metric: 'api_access', limit_value: 1, period: 'static' }, // true
      { metric: 'dedicated_ip', limit_value: 0, period: 'static' }, // false
      { metric: 'uptime_sla', limit_value: 0, period: 'static' }, // false
      { metric: 'sso', limit_value: 0, period: 'static' }, // false
      { metric: 'retention_days', limit_value: 30, period: 'static' },
      // PAYG sentinel — plan enforcement uses this to require credit balance check
      { metric: 'requires_credit_balance', limit_value: 1, period: 'static' },
    ],
  },
];

/**
 * Seed all plans and their limits.
 * Safe to re-run — uses upsert throughout.
 */
export async function seedPlanLimits(prisma: PrismaClient): Promise<void> {
  try {
    for (const planDef of PLANS) {
      const plan = await prisma.plan.upsert({
        where: { name: planDef.name },
        update: {
          price_monthly: planDef.price_monthly,
          price_yearly: planDef.price_yearly,
          active: true,
        },
        create: {
          name: planDef.name,
          price_monthly: planDef.price_monthly,
          price_yearly: planDef.price_yearly,
          currency: 'USD',
          active: true,
        },
      });

      for (const limit of planDef.limits) {
        await prisma.planLimit.upsert({
          where: { plan_id_metric: { plan_id: plan.id, metric: limit.metric } },
          update: { limit_value: limit.limit_value, period: limit.period },
          create: {
            plan_id: plan.id,
            metric: limit.metric,
            limit_value: limit.limit_value,
            period: limit.period,
          },
        });
      }

      console.log(`✅ Plan seeded: ${planDef.name} (${planDef.limits.length} limits)`);
    }

    console.log('✅ All plans and limits seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed plan limits:', error);
    throw error;
  }
}

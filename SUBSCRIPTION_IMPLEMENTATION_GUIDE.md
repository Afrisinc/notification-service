# Subscription Plan Implementation Guide
## Professional Backend Architecture & Access Control Strategy

---

## 📊 CURRENT PLAN STRUCTURE

Based on analysis of the backend models and seed data:

### Plans Available

| Plan | Monthly | Yearly | Currency |
|------|---------|--------|----------|
| **FREE** | $0 | $0 | USD |
| **PRO** | $29.99 | $299.90 | USD |
| **ENTERPRISE** | $99.99 | $999.90 | USD |

---

## 📋 RECOMMENDED PLAN LIMITATIONS

### Feature Matrix

| Feature | FREE | PRO | ENTERPRISE |
|---------|------|-----|------------|
| **Emails per Month** | 1,000 | 100,000 | Unlimited |
| **SMS per Month** | 0 | 10,000 | Unlimited |
| **API Calls per Month** | 10,000 | 1M | Unlimited |
| **Contacts** | 500 | 100,000 | Unlimited |
| **Templates** | 5 | Unlimited | Unlimited |
| **Apps** | 1 | 10 | Unlimited |
| **Team Members** | 1 | 5 | Unlimited |
| **API Keys** | 1 | 10 | Unlimited |
| **Campaign Limit** | 2 | 50 | Unlimited |
| **Retention Days** | 30 | 90 | 1 Year |
| **Support** | Community | Email | 24/7 Priority |
| **Webhooks** | 1 | 10 | Unlimited |
| **Custom Domain** | ❌ | ✅ | ✅ |
| **Advanced Analytics** | ❌ | ✅ | ✅ |

---

## 🏗️ BACKEND ARCHITECTURE

### Database Models (Already in Place)

```
┌─────────────────────┐
│   Account           │
├─────────────────────┤
│ - id (PK)           │
│ - subscription_id   │◄──────┐
│ - usageRecords[]    │       │
└─────────────────────┘       │
                              │
                    ┌─────────┴──────────┐
                    │                    │
            ┌───────▼──────────┐   ┌──────▼─────────┐
            │ Subscription     │   │ UsageRecord    │
            ├──────────────────┤   ├────────────────┤
            │ - id             │   │ - id           │
            │ - account_id (FK)│   │ - account_id   │
            │ - plan_id (FK)   │───│ - metric       │
            │ - status         │   │ - quantity     │
            │ - billing_cycle  │   │ - timestamp    │
            │ - current_period │   └────────────────┘
            └────────┬─────────┘
                     │
            ┌────────▼──────────┐
            │ Plan              │
            ├───────────────────┤
            │ - id              │
            │ - name (UNIQUE)   │
            │ - price_monthly   │
            │ - price_yearly    │
            │ - limits[]        │
            └────────┬──────────┘
                     │
            ┌────────▼──────────┐
            │ PlanLimit         │
            ├───────────────────┤
            │ - id              │
            │ - plan_id (FK)    │
            │ - metric (UNIQUE) │
            │ - limit_value     │
            │ - period          │
            └───────────────────┘
```

### Available Models
- ✅ Account (with subscription relation)
- ✅ Subscription (status, billing_cycle, provider)
- ✅ Plan (name, pricing)
- ✅ PlanLimit (metric-based limits)
- ✅ UsageRecord (tracking metrics)
- ✅ App, Template, Campaign, Contact (entities to limit)

---

## 🔐 PROFESSIONAL IMPLEMENTATION FLOW

### Phase 1: Seed Plan Limits

**File: `src/shared/database/seeds/plans.seed.ts`**

```typescript
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
  const plans = await prisma.plan.findMany();

  for (const plan of plans) {
    const limits = PLAN_LIMITS[plan.name as keyof typeof PLAN_LIMITS];

    for (const [metric, value] of Object.entries(limits)) {
      if (value === true || value === false) continue; // Skip booleans, handle separately

      await prisma.planLimit.upsert({
        where: { plan_id_metric: { plan_id: plan.id, metric } },
        update: { limit_value: value === null ? -1 : value }, // -1 = unlimited
        create: {
          plan_id: plan.id,
          metric,
          limit_value: value === null ? -1 : value,
          period: metric.includes('month') ? 'monthly' : 'daily',
        },
      });
    }
  }
}
```

---

### Phase 2: Plan Enforcement Middleware

**File: `src/services/api/src/middleware/plan-enforcement.middleware.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { prismaRead } from '@shared/database';

interface PlanCheckOptions {
  feature: string;
  metric?: string;
  quantityRequired?: number;
}

export class PlanEnforcementMiddleware {
  /**
   * Check if account can access a feature based on their plan
   */
  static async checkFeatureAccess(req: FastifyRequest, feature: string): Promise<boolean> {
    const accountId = req.headers['x-account-id'] as string;
    if (!accountId) return false;

    const subscription = await prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: {
        plan: {
          include: { limits: true },
        },
      },
    });

    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    // Feature-to-limit mapping
    const featureMap: Record<string, string> = {
      'custom_domain': 'custom_domain',
      'advanced_analytics': 'advanced_analytics',
      'webhooks': 'webhooks',
      'team_management': 'team_members',
      'api_keys': 'api_keys',
    };

    const metric = featureMap[feature];
    if (!metric) return true; // Unknown feature = allow

    const limit = subscription.plan.limits.find(l => l.metric === metric);

    // Boolean features
    if (feature === 'custom_domain' || feature === 'advanced_analytics') {
      return limit?.limit_value !== 0; // 0 or null = disabled
    }

    return true;
  }

  /**
   * Check if usage exceeds plan limit
   */
  static async checkUsageLimit(
    accountId: string,
    metric: string
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const subscription = await prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: { plan: { include: { limits: true } } },
    });

    if (!subscription) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const planLimit = subscription.plan.limits.find(l => l.metric === metric);

    if (!planLimit || planLimit.limit_value === -1) {
      return { allowed: true, remaining: Infinity, limit: -1 }; // Unlimited
    }

    // Get usage for current period
    const period = planLimit.period;
    const startDate = this.getPeriodStart(period);

    const usage = await prismaRead.usageRecord.aggregate({
      where: {
        account_id: accountId,
        metric,
        timestamp: { gte: startDate },
      },
      _sum: { quantity: true },
    });

    const used = usage._sum.quantity || 0;
    const remaining = Math.max(0, planLimit.limit_value - used);

    return {
      allowed: remaining > 0,
      remaining,
      limit: planLimit.limit_value,
    };
  }

  private static getPeriodStart(period: string): Date {
    const now = new Date();

    switch (period) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      default:
        return now;
    }
  }
}
```

---

### Phase 3: Request Guards (Prehandlers)

**File: `src/services/api/src/guards/plan-guard.ts`**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { PlanEnforcementMiddleware } from '../middleware/plan-enforcement.middleware';
import { ApiResponseHelper } from '../utils/api-response';

export const planGuards = {
  /**
   * Guard: Ensure feature is available in plan
   */
  async requireFeature(feature: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const allowed = await PlanEnforcementMiddleware.checkFeatureAccess(request, feature);

      if (!allowed) {
        return ApiResponseHelper.planLimitExceeded(
          reply,
          `Feature "${feature}" is not available in your current plan`
        );
      }
    };
  },

  /**
   * Guard: Check usage limit for metric
   */
  async checkUsageLimit(metric: string, quantityRequired: number = 1) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = request.headers['x-account-id'] as string;

      const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, metric);

      if (!result.allowed || result.remaining < quantityRequired) {
        return ApiResponseHelper.planLimitExceeded(
          reply,
          `Usage limit exceeded for "${metric}". Limit: ${result.limit}, Remaining: ${result.remaining}`
        );
      }
    };
  },

  /**
   * Guard: Check entity count limit
   */
  async checkEntityLimit(entity: 'apps' | 'templates' | 'campaigns') {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const accountId = request.headers['x-account-id'] as string;

      const result = await PlanEnforcementMiddleware.checkUsageLimit(accountId, entity);

      if (!result.allowed) {
        return ApiResponseHelper.planLimitExceeded(
          reply,
          `Cannot create more ${entity}. Limit: ${result.limit}`
        );
      }
    };
  },
};
```

---

### Phase 4: Usage Tracking Service

**File: `src/services/api/src/services/usage-tracking.service.ts`**

```typescript
import { prismaWrite } from '@shared/database';

export class UsageTrackingService {
  /**
   * Record usage metric
   */
  static async recordUsage(
    accountId: string,
    appId: string,
    metric: string,
    quantity: number = 1
  ): Promise<void> {
    try {
      await prismaWrite.usageRecord.create({
        data: {
          account_id: accountId,
          app_id: appId,
          metric,
          quantity,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Log but don't fail the request
    }
  }

  /**
   * Record multiple usage metrics at once
   */
  static async recordBulkUsage(
    accountId: string,
    appId: string,
    metrics: Record<string, number>
  ): Promise<void> {
    const records = Object.entries(metrics).map(([metric, quantity]) => ({
      account_id: accountId,
      app_id: appId,
      metric,
      quantity,
      timestamp: new Date(),
    }));

    try {
      await prismaWrite.usageRecord.createMany({ data: records });
    } catch (error) {
      console.error('Failed to record bulk usage:', error);
    }
  }

  /**
   * Get usage summary for a period
   */
  static async getUsageSummary(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const usage = await prismaWrite.usageRecord.groupBy({
      by: ['metric'],
      where: {
        account_id: accountId,
        timestamp: { gte: startDate, lte: endDate },
      },
      _sum: { quantity: true },
    });

    const summary: Record<string, number> = {};
    for (const item of usage) {
      summary[item.metric] = item._sum.quantity || 0;
    }

    return summary;
  }
}
```

---

### Phase 5: API Response Extension

**File: `src/services/api/src/utils/api-response.ts` (Update)**

```typescript
export class ApiResponseHelper {
  // ... existing methods ...

  static planLimitExceeded(
    reply: FastifyReply,
    message: string = 'Plan limit exceeded'
  ) {
    return this.error(
      reply,
      message,
      ResponseCode.PLAN_LIMIT_EXCEEDED, // Add this code
      403
    );
  }

  static featureNotAvailable(
    reply: FastifyReply,
    feature: string
  ) {
    return this.error(
      reply,
      `Feature "${feature}" is not available in your current plan`,
      ResponseCode.FEATURE_NOT_AVAILABLE, // Add this code
      403
    );
  }
}

// Add to ResponseCode enum
export enum ResponseCode {
  // ... existing codes ...
  PLAN_LIMIT_EXCEEDED = 4020,
  FEATURE_NOT_AVAILABLE = 4021,
}
```

---

### Phase 6: Route Protection Implementation

**File: `src/services/api/src/routes/contact.routes.ts` (Example)**

```typescript
import { FastifyInstance } from 'fastify';
import { planGuards } from '../guards/plan-guard';
import { contactController } from '../controllers/contact.controller';

export async function contactRoutes(fastify: FastifyInstance) {
  // Create contact - check usage limit
  fastify.post<{ Params: { appId: string } }>(
    '/apps/:appId/contacts',
    {
      preHandler: [
        fastify.authenticate,
        planGuards.checkUsageLimit('contacts', 1),
      ],
      schema: CreateContactSchema,
    },
    contactController.create
  );

  // Bulk import - check usage limit for quantity
  fastify.post<{ Params: { appId: string } }>(
    '/apps/:appId/contacts/bulk-import',
    {
      preHandler: [
        fastify.authenticate,
        async (req, reply) => {
          const quantity = req.body?.contacts?.length || 0;
          await planGuards.checkUsageLimit('contacts', quantity)(req, reply);
        },
      ],
    },
    contactController.bulkImport
  );

  // Advanced analytics - feature check
  fastify.get<{ Params: { appId: string } }>(
    '/apps/:appId/analytics/advanced',
    {
      preHandler: [
        fastify.authenticate,
        planGuards.requireFeature('advanced_analytics'),
      ],
    },
    contactController.getAdvancedAnalytics
  );
}
```

---

### Phase 7: Usage Recording on Operations

**File: `src/services/api/src/controllers/contact.controller.ts` (Update)**

```typescript
import { UsageTrackingService } from '../services/usage-tracking.service';

export const contactController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const accountId = request.headers['x-account-id'] as string;
    const appId = request.params.appId as string;

    // Create contact
    const contact = await contactService.create(appId, request.body);

    // Record usage
    await UsageTrackingService.recordUsage(
      accountId,
      appId,
      'contacts',
      1
    );

    return ApiResponseHelper.success(reply, 'Contact created', contact, 201);
  },

  async bulkImport(request: FastifyRequest, reply: FastifyReply) {
    const accountId = request.headers['x-account-id'] as string;
    const appId = request.params.appId as string;
    const contacts = request.body.contacts as any[];

    // Import contacts
    const result = await contactService.bulkImport(appId, contacts);

    // Record usage
    await UsageTrackingService.recordUsage(
      accountId,
      appId,
      'contacts',
      result.imported
    );

    return ApiResponseHelper.success(reply, 'Contacts imported', result);
  },

  async sendNotification(request: FastifyRequest, reply: FastifyReply) {
    const accountId = request.headers['x-account-id'] as string;
    const appId = request.params.appId as string;
    const channel = request.body.channel as string; // 'email' | 'sms'

    // Send notification
    const result = await notificationService.send(appId, request.body);

    // Record usage by channel
    const metric = channel === 'email'
      ? 'emails_per_month'
      : 'sms_per_month';

    await UsageTrackingService.recordUsage(
      accountId,
      appId,
      metric,
      1
    );

    return ApiResponseHelper.success(reply, 'Notification sent', result);
  },
};
```

---

## 🚀 ROLLOUT STRATEGY

### Step 1: Database Setup
```bash
# Update schema.prisma with plan_limits and usage_records (if missing)
npx prisma migrate dev --name add_plan_enforcement

# Seed plans and limits
npx ts-node src/shared/database/seeds/plans.seed.ts
```

### Step 2: Middleware & Guards
- Add `PlanEnforcementMiddleware` class
- Add `planGuards` with all guard functions
- Add response codes to `ApiResponseHelper`

### Step 3: Usage Tracking
- Add `UsageTrackingService` class
- Integrate into all relevant controllers
- Test recording of metrics

### Step 4: Route Protection (Phased)
```
Week 1: Contact limits (least disruptive)
Week 2: Template & Campaign limits
Week 3: App & Team limits
Week 4: Feature flags (custom_domain, analytics)
Week 5: API rate limits
```

### Step 5: Monitoring
```typescript
// Add endpoint to dashboard
fastify.get('/api/account/usage', async (request, reply) => {
  const accountId = request.headers['x-account-id'];
  const subscription = await getSubscriptionWithLimits(accountId);
  const usage = await UsageTrackingService.getUsageSummary(
    accountId,
    getPeriodStart(subscription.plan),
    new Date()
  );

  return formatUsageResponse(subscription, usage);
});
```

---

## 💾 DATABASE MIGRATION

```prisma
// Add to schema.prisma if not present

model PlanLimit {
  id          String   @id @default(uuid())
  plan_id     String
  metric      String   // e.g., "emails_per_month", "contacts"
  limit_value Int      // -1 = unlimited
  period      String   // "monthly" | "yearly" | "daily"

  plan        Plan     @relation(fields: [plan_id], references: [id], onDelete: Cascade)

  @@unique([plan_id, metric])
  @@index([plan_id])
  @@map("plan_limits")
}

model UsageRecord {
  id          String   @id @default(uuid())
  account_id  String
  app_id      String
  metric      String
  quantity    Int
  timestamp   DateTime @default(now())

  account     Account  @relation(fields: [account_id], references: [id], onDelete: Cascade)
  app         App      @relation(fields: [app_id], references: [id], onDelete: Cascade)

  @@index([account_id])
  @@index([app_id])
  @@index([metric])
  @@index([timestamp])
  @@map("usage_records")
}
```

---

## 📊 MONITORING & ALERTING

### Usage Dashboard Query
```typescript
async function getUserDashboard(accountId: string) {
  const subscription = await prismaRead.subscription.findUnique({
    where: { account_id: accountId },
    include: {
      plan: { include: { limits: true } }
    }
  });

  const periodStart = getPeriodStart(subscription.plan.limits[0].period);
  const usage = await UsageTrackingService.getUsageSummary(
    accountId,
    periodStart,
    new Date()
  );

  return {
    plan: subscription.plan.name,
    billing_cycle: subscription.billing_cycle,
    limits: subscription.plan.limits.map(limit => ({
      metric: limit.metric,
      limit: limit.limit_value === -1 ? 'Unlimited' : limit.limit_value,
      used: usage[limit.metric] || 0,
      remaining: limit.limit_value === -1
        ? 'Unlimited'
        : Math.max(0, limit.limit_value - (usage[limit.metric] || 0)),
      percentage: limit.limit_value === -1
        ? 0
        : ((usage[limit.metric] || 0) / limit.limit_value) * 100,
    }))
  };
}
```

### Alert Thresholds
- 🟡 **75% Used** → Email: "Approaching limit"
- 🔴 **90% Used** → Email + In-app notification
- 🛑 **100% Used** → Blocking, upgrade prompt

---

## 🔗 INTEGRATION CHECKLIST

- [ ] Database migrations applied
- [ ] Plan limits seeded
- [ ] PlanEnforcementMiddleware implemented
- [ ] Plan guards created
- [ ] UsageTrackingService created
- [ ] ApiResponseHelper extended
- [ ] Contact routes protected
- [ ] Campaign routes protected
- [ ] Template routes protected
- [ ] App creation routes protected
- [ ] Notification sending routes protected
- [ ] Usage dashboard endpoint
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Tests written for guards
- [ ] Load testing for usage tracking

---

## 🎯 BEST PRACTICES

1. **Always Check Before Allow** - Validate subscription status before every operation
2. **Graceful Degradation** - Continue operations, just don't record if tracking fails
3. **Batch Recording** - Use `recordBulkUsage` for operations affecting multiple entities
4. **Period-Based Limits** - Reset metrics monthly/yearly automatically via scheduled job
5. **Transparent Errors** - Always return remaining limit in error messages
6. **Audit Trail** - Log all limit-based rejections for billing disputes
7. **Upgrade Path** - Clear error messages should suggest upgrading
8. **Free Trial** - Consider giving new FREE users higher limits for first 30 days

---

## 📱 Frontend Integration

```typescript
// React Hook Example
function useAccountLimits() {
  const [limits, setLimits] = useState(null);

  useEffect(() => {
    async function fetchLimits() {
      const response = await fetch('/api/account/usage', {
        headers: { 'x-account-id': accountId }
      });
      const data = await response.json();
      setLimits(data.data);
    }
    fetchLimits();
  }, []);

  return limits;
}

// Usage Bar Component
function UsageBar({ metric, used, limit }) {
  const percentage = (used / limit) * 100;
  const color = percentage > 90 ? 'red' : percentage > 75 ? 'orange' : 'green';

  return (
    <div className="usage-bar">
      <div className={`bar ${color}`} style={{ width: `${percentage}%` }} />
      <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
    </div>
  );
}
```

---

Generated: 2026-03-26
Notification Service - AfriSinc Notify Platform

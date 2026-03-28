# Plan Limits Management API
## Admin Endpoints for Dynamic Limit Configuration

---

## 🎯 Overview

Instead of hardcoding limits in seeds, manage them dynamically via API. Allows:
- ✅ Update limits without redeploying
- ✅ A/B test different limit tiers
- ✅ Adjust limits per customer (enterprise customers)
- ✅ Time-limited promotions (e.g., 2x limits for 30 days)
- ✅ Audit trail of all limit changes

---

## 📡 API Endpoints

### 1. List All Plan Limits

```http
GET /api/admin/plans
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-1",
      "name": "FREE",
      "price_monthly": 0,
      "price_yearly": 0,
      "limits": [
        {
          "id": "limit-1",
          "metric": "emails_per_month",
          "limit_value": 1000,
          "period": "monthly"
        },
        {
          "id": "limit-2",
          "metric": "contacts",
          "limit_value": 500,
          "period": "unlimited"
        }
      ]
    },
    {
      "id": "plan-2",
      "name": "PRO",
      "price_monthly": 29.99,
      "price_yearly": 299.9,
      "limits": [...]
    }
  ]
}
```

---

### 2. Get Specific Plan with Limits

```http
GET /api/admin/plans/:planId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plan-1",
    "name": "FREE",
    "price_monthly": 0,
    "active": true,
    "limits": [
      {
        "id": "limit-1",
        "metric": "emails_per_month",
        "limit_value": 1000,
        "period": "monthly"
      }
    ]
  }
}
```

---

### 3. Update Plan Limit

```http
PUT /api/admin/plans/:planId/limits/:limitId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "limit_value": 5000,
  "reason": "Promotional increase for Q1 2026"
}
```

**Response:**
```json
{
  "success": true,
  "resp_msg": "Limit updated successfully",
  "data": {
    "id": "limit-1",
    "plan_id": "plan-1",
    "metric": "emails_per_month",
    "limit_value": 5000,
    "period": "monthly",
    "previous_value": 1000,
    "updated_at": "2026-03-26T10:30:00Z"
  }
}
```

---

### 4. Batch Update Multiple Limits

```http
PUT /api/admin/plans/:planId/limits/batch
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "updates": [
    {
      "metric": "emails_per_month",
      "limit_value": 2000
    },
    {
      "metric": "contacts",
      "limit_value": 1000
    },
    {
      "metric": "api_calls_per_month",
      "limit_value": 50000
    }
  ],
  "reason": "Yearly pricing tier adjustment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan_id": "plan-1",
    "updated_count": 3,
    "limits": [
      { "metric": "emails_per_month", "old_value": 1000, "new_value": 2000 },
      { "metric": "contacts", "old_value": 500, "new_value": 1000 },
      { "metric": "api_calls_per_month", "old_value": 10000, "new_value": 50000 }
    ]
  }
}
```

---

### 5. Create Custom Limit for a Plan

```http
POST /api/admin/plans/:planId/limits
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "metric": "storage_gb",
  "limit_value": 5,
  "period": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "limit-new-1",
    "plan_id": "plan-1",
    "metric": "storage_gb",
    "limit_value": 5,
    "period": "monthly",
    "created_at": "2026-03-26T10:30:00Z"
  }
}
```

---

### 6. Delete a Limit

```http
DELETE /api/admin/plans/:planId/limits/:limitId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "resp_msg": "Limit deleted successfully"
}
```

---

### 7. Get Limit Change History

```http
GET /api/admin/plans/:planId/limits/history
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "change-1",
      "limit_id": "limit-1",
      "metric": "emails_per_month",
      "old_value": 1000,
      "new_value": 5000,
      "reason": "Promotional increase for Q1 2026",
      "changed_by": "admin@company.com",
      "changed_at": "2026-03-26T10:30:00Z"
    },
    {
      "id": "change-2",
      "limit_id": "limit-1",
      "metric": "emails_per_month",
      "old_value": 500,
      "new_value": 1000,
      "reason": "Initial plan setup",
      "changed_by": "system",
      "changed_at": "2026-03-15T00:00:00Z"
    }
  ]
}
```

---

### 8. Set Temporary Limit Override (for specific account)

```http
POST /api/admin/accounts/:accountId/limit-override
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "metric": "emails_per_month",
  "temporary_limit": 50000,
  "expires_at": "2026-04-26T23:59:59Z",
  "reason": "Enterprise customer special deal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "override-1",
    "account_id": "acc-123",
    "metric": "emails_per_month",
    "plan_limit": 5000,
    "temporary_limit": 50000,
    "expires_at": "2026-04-26T23:59:59Z",
    "created_at": "2026-03-26T10:30:00Z"
  }
}
```

---

### 9. Get Account Limit Overrides

```http
GET /api/admin/accounts/:accountId/limit-overrides
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "override-1",
      "metric": "emails_per_month",
      "plan_limit": 5000,
      "temporary_limit": 50000,
      "expires_at": "2026-04-26T23:59:59Z",
      "is_active": true
    }
  ]
}
```

---

## 🔧 Backend Implementation

### Database Schema Update

```prisma
model LimitChangeHistory {
  id            String   @id @default(uuid())
  limit_id      String
  metric        String
  old_value     Int
  new_value     Int
  reason        String?
  changed_by    String   // admin email or "system"
  changed_at    DateTime @default(now())

  planLimit     PlanLimit @relation(fields: [limit_id], references: [id], onDelete: Cascade)

  @@index([limit_id])
  @@index([changed_at])
  @@map("limit_change_history")
}

model LimitOverride {
  id              String    @id @default(uuid())
  account_id      String
  metric          String
  plan_limit      Int       // original plan limit
  temporary_limit Int       // override limit
  expires_at      DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  account         Account   @relation(fields: [account_id], references: [id], onDelete: Cascade)

  @@index([account_id])
  @@index([expires_at])
  @@unique([account_id, metric])
  @@map("limit_overrides")
}
```

---

### Service Implementation

```typescript
// src/services/api/src/services/plan-management.service.ts

import { prismaWrite, prismaRead } from '@shared/database';

export class PlanManagementService {
  /**
   * Update a single limit
   */
  static async updateLimit(
    planId: string,
    limitId: string,
    newValue: number,
    reason?: string,
    changedBy: string = 'api'
  ) {
    // Get old value for history
    const oldLimit = await prismaRead.planLimit.findUnique({
      where: { id: limitId },
    });

    if (!oldLimit) {
      throw new Error('Limit not found');
    }

    // Update limit
    const updated = await prismaWrite.planLimit.update({
      where: { id: limitId },
      data: { limit_value: newValue },
    });

    // Record change history
    await prismaWrite.limitChangeHistory.create({
      data: {
        limit_id: limitId,
        metric: oldLimit.metric,
        old_value: oldLimit.limit_value,
        new_value: newValue,
        reason,
        changed_by: changedBy,
      },
    });

    return updated;
  }

  /**
   * Batch update limits for a plan
   */
  static async batchUpdateLimits(
    planId: string,
    updates: Array<{ metric: string; limit_value: number }>,
    reason?: string,
    changedBy: string = 'api'
  ) {
    const results = [];

    for (const update of updates) {
      const limit = await prismaRead.planLimit.findFirst({
        where: { plan_id: planId, metric: update.metric },
      });

      if (limit) {
        const updated = await this.updateLimit(
          planId,
          limit.id,
          update.limit_value,
          reason,
          changedBy
        );
        results.push(updated);
      }
    }

    return results;
  }

  /**
   * Get effective limit (considering overrides)
   */
  static async getEffectiveLimit(
    accountId: string,
    metric: string
  ): Promise<number> {
    // Check for active override
    const override = await prismaRead.limitOverride.findUnique({
      where: { account_id_metric: { account_id: accountId, metric } },
    });

    if (
      override &&
      (!override.expires_at || override.expires_at > new Date())
    ) {
      return override.temporary_limit;
    }

    // Get plan limit
    const subscription = await prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: { plan: { include: { limits: true } } },
    });

    const limit = subscription?.plan.limits.find(l => l.metric === metric);
    return limit?.limit_value || 0;
  }

  /**
   * Set temporary override for account
   */
  static async setTemporaryOverride(
    accountId: string,
    metric: string,
    temporaryLimit: number,
    expiresAt?: Date,
    reason?: string
  ) {
    const subscription = await prismaRead.subscription.findUnique({
      where: { account_id: accountId },
      include: { plan: { include: { limits: true } } },
    });

    const planLimit = subscription?.plan.limits.find(l => l.metric === metric);
    if (!planLimit) {
      throw new Error(`Metric ${metric} not found in plan`);
    }

    return prismaWrite.limitOverride.upsert({
      where: { account_id_metric: { account_id: accountId, metric } },
      update: {
        temporary_limit: temporaryLimit,
        expires_at: expiresAt,
      },
      create: {
        account_id: accountId,
        metric,
        plan_limit: planLimit.limit_value,
        temporary_limit: temporaryLimit,
        expires_at: expiresAt,
      },
    });
  }

  /**
   * Clean up expired overrides (scheduled job)
   */
  static async cleanupExpiredOverrides() {
    const deleted = await prismaWrite.limitOverride.deleteMany({
      where: {
        expires_at: { lte: new Date() },
      },
    });

    return deleted.count;
  }
}
```

---

### Route Implementation

```typescript
// src/services/api/src/routes/admin/plan-management.routes.ts

import { FastifyInstance } from 'fastify';
import { PlanManagementService } from '../../services/plan-management.service';
import { ApiResponseHelper } from '../../utils/api-response';

export async function planManagementRoutes(fastify: FastifyInstance) {
  // Require admin role
  const adminGuard = async (request, reply) => {
    if (request.user?.role !== 'admin') {
      return ApiResponseHelper.unauthorized(
        reply,
        'Admin access required'
      );
    }
  };

  // List all plans with limits
  fastify.get(
    '/api/admin/plans',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const plans = await prismaRead.plan.findMany({
        include: { limits: true },
      });

      return ApiResponseHelper.success(reply, 'Plans retrieved', plans);
    }
  );

  // Get plan with limits
  fastify.get(
    '/api/admin/plans/:planId',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const plan = await prismaRead.plan.findUnique({
        where: { id: request.params.planId },
        include: { limits: true },
      });

      if (!plan) {
        return ApiResponseHelper.notFound(reply, 'Plan not found');
      }

      return ApiResponseHelper.success(reply, 'Plan retrieved', plan);
    }
  );

  // Update single limit
  fastify.put(
    '/api/admin/plans/:planId/limits/:limitId',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const { limit_value, reason } = request.body as any;

      const updated = await PlanManagementService.updateLimit(
        request.params.planId,
        request.params.limitId,
        limit_value,
        reason,
        request.user.email
      );

      return ApiResponseHelper.success(
        reply,
        'Limit updated',
        updated,
        200
      );
    }
  );

  // Batch update limits
  fastify.put(
    '/api/admin/plans/:planId/limits/batch',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const { updates, reason } = request.body as any;

      const results = await PlanManagementService.batchUpdateLimits(
        request.params.planId,
        updates,
        reason,
        request.user.email
      );

      return ApiResponseHelper.success(
        reply,
        'Limits updated',
        {
          plan_id: request.params.planId,
          updated_count: results.length,
          limits: results,
        },
        200
      );
    }
  );

  // Get limit change history
  fastify.get(
    '/api/admin/plans/:planId/limits/history',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const history = await prismaRead.limitChangeHistory.findMany({
        where: {
          planLimit: { plan_id: request.params.planId },
        },
        orderBy: { changed_at: 'desc' },
      });

      return ApiResponseHelper.success(reply, 'History retrieved', history);
    }
  );

  // Set temporary override for account
  fastify.post(
    '/api/admin/accounts/:accountId/limit-override',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const { metric, temporary_limit, expires_at, reason } = request.body as any;

      const override = await PlanManagementService.setTemporaryOverride(
        request.params.accountId,
        metric,
        temporary_limit,
        expires_at ? new Date(expires_at) : undefined,
        reason
      );

      return ApiResponseHelper.success(
        reply,
        'Override set',
        override,
        201
      );
    }
  );

  // Get account overrides
  fastify.get(
    '/api/admin/accounts/:accountId/limit-overrides',
    { preHandler: [fastify.authenticate, adminGuard] },
    async (request, reply) => {
      const overrides = await prismaRead.limitOverride.findMany({
        where: { account_id: request.params.accountId },
      });

      return ApiResponseHelper.success(reply, 'Overrides retrieved', overrides);
    }
  );
}
```

---

## 📊 Using Limits in PlanEnforcementMiddleware

Update the middleware to check for overrides:

```typescript
export class PlanEnforcementMiddleware {
  static async checkUsageLimit(
    accountId: string,
    metric: string
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    // Get effective limit (considering overrides)
    const effectiveLimit = await PlanManagementService.getEffectiveLimit(
      accountId,
      metric
    );

    if (effectiveLimit === -1) {
      return { allowed: true, remaining: Infinity, limit: -1 }; // Unlimited
    }

    // Get current usage
    const period = await this.getPeriodForMetric(metric);
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
    const remaining = Math.max(0, effectiveLimit - used);

    return {
      allowed: remaining > 0,
      remaining,
      limit: effectiveLimit,
    };
  }
}
```

---

## 🔄 Scheduled Job: Clean Up Expired Overrides

```typescript
// Run daily at 2 AM
export async function cleanupExpiredLimitOverrides() {
  const deleted = await PlanManagementService.cleanupExpiredOverrides();
  console.log(`Cleaned up ${deleted} expired limit overrides`);
}
```

---

## ✅ Use Cases

### 1. Black Friday Promotion
```bash
curl -X PUT http://localhost:3000/api/admin/plans/plan-1/limits/batch \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "updates": [
      { "metric": "emails_per_month", "limit_value": 50000 },
      { "metric": "contacts", "limit_value": 250000 }
    ],
    "reason": "Black Friday 2x limits promotion"
  }'
```

### 2. Enterprise Customer Special Deal
```bash
curl -X POST http://localhost:3000/api/admin/accounts/acc-123/limit-override \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "metric": "emails_per_month",
    "temporary_limit": 1000000,
    "expires_at": "2026-06-26T23:59:59Z",
    "reason": "Annual enterprise contract - special negotiated rate"
  }'
```

### 3. Gradual Plan Adjustment
```bash
# Q1: Increase PRO limits
curl -X PUT http://localhost:3000/api/admin/plans/plan-2/limits/batch \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "updates": [
      { "metric": "emails_per_month", "limit_value": 150000 },
      { "metric": "contacts", "limit_value": 150000 }
    ],
    "reason": "Q1 2026 pricing tier increase"
  }'
```

---

## 🎯 Summary

✅ **Dynamic Management** - Change limits without redeploying
✅ **Audit Trail** - Full history of all changes
✅ **Overrides** - Per-account temporary limit adjustments
✅ **Cleanup** - Automatic expiration of temporary overrides
✅ **Admin-Only** - Requires admin role for all management endpoints
✅ **Real-Time** - Changes take effect immediately

Generated: 2026-03-26

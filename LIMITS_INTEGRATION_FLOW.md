# Plan Limits Integration Flow
## How Management API Works with Enforcement System

---

## 🔄 Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN PORTAL                             │
│  (Update limits, set overrides, view history)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  PLAN LIMITS API ENDPOINTS │
        │  /api/admin/plans/*        │
        │  /api/admin/accounts/*     │
        └────────────┬───────────────┘
                     │
        ┌────────────▼───────────────┐
        │  Database Updates:         │
        │  - PlanLimit table         │
        │  - LimitOverride table     │
        │  - LimitChangeHistory      │
        └────────────┬───────────────┘
                     │
        ┌────────────▼───────────────────────────────────┐
        │  Real-time Enforcement                        │
        │  (No deployment needed!)                       │
        └────────────┬───────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐  ┌──────────────┐  ┌──────────────┐
│ Contact │  │ Notification │  │  Templates   │
│ Create  │  │   Send       │  │  Create      │
│ Guard   │  │  Guard       │  │  Guard       │
└────┬────┘  └──────┬───────┘  └──────┬───────┘
     │              │                  │
     └──────────────┼──────────────────┘
                    │
        ┌───────────▼───────────┐
        │ PlanEnforcement       │
        │ Middleware            │
        │                       │
        │ 1. Get Subscription   │
        │ 2. Check Override     │
        │ 3. Check Usage        │
        │ 4. Return Allowed     │
        └───────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │ Request Allowed?    │
         └──────┬─────┬────────┘
                │     │
            YES │     │ NO
                ▼     ▼
          ┌────────┐ ┌──────────────┐
          │ Execute│ │ Return Error │
          │  Route │ │ "Limit: X,   │
          │        │ │  Remaining:Y"│
          └────┬───┘ └──────────────┘
               │
        ┌──────▼────────┐
        │ Usage Tracking│
        │ Service       │
        │ Record metric │
        └───────────────┘
```

---

## 🎬 Real Example: Increasing Email Limits

### Step 1: Admin Updates Limit (No Deployment)

```bash
curl -X PUT \
  http://localhost:3000/api/admin/plans/plan-free/limits/emails \
  -H "Authorization: Bearer admin-token" \
  -d '{
    "limit_value": 5000,
    "reason": "New Year Promotion 2026"
  }'
```

**Database Changes:**
```
Before: PlanLimit { metric: "emails_per_month", limit_value: 1000 }
After:  PlanLimit { metric: "emails_per_month", limit_value: 5000 }

New Record in LimitChangeHistory:
{
  limit_id: "limit-123",
  metric: "emails_per_month",
  old_value: 1000,
  new_value: 5000,
  changed_by: "admin@company.com",
  changed_at: "2026-03-26T10:30:00Z"
}
```

### Step 2: User Tries to Send Email

Request hits the API:
```bash
POST /api/apps/app-xyz/notifications/send
{
  "channel": "email",
  "to": "user@example.com",
  "subject": "Hello"
}
```

### Step 3: Guard Checks Usage Limit

```typescript
// Prehandler executes BEFORE controller
planGuards.checkUsageLimit('emails_per_month', 1)

// Inside the guard:
1. Get user's subscription
   → SELECT * FROM subscriptions WHERE account_id = "user-123"
   → Get plan_id: "plan-free"

2. Check for override (new!)
   → SELECT * FROM limit_overrides
     WHERE account_id = "user-123" AND metric = "emails_per_month"
   → No override found (or expired)

3. Get effective limit from database
   → SELECT limit_value FROM plan_limits
     WHERE plan_id = "plan-free" AND metric = "emails_per_month"
   → Returns: 5000 (✅ UPDATED!)

4. Get current month usage
   → SELECT SUM(quantity) FROM usage_records
     WHERE account_id = "user-123"
     AND metric = "emails_per_month"
     AND timestamp >= first_of_month()
   → Returns: 4999 sent this month

5. Check if allowed
   → remaining = 5000 - 4999 = 1 ✅
   → allowed = true ✅
```

### Step 4: Request Allowed, Execute & Track

```typescript
// Controller executes
const result = await sendEmailNotification(...)

// Track usage
await UsageTrackingService.recordUsage(
  accountId: "user-123",
  appId: "app-xyz",
  metric: "emails_per_month",
  quantity: 1
)

// Response includes remaining
{
  "success": true,
  "data": { ... email sent ... },
  "headers": {
    "X-RateLimit-Limit": "5000",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "2026-04-01T00:00:00Z"
  }
}
```

### Step 5: User Hits New Limit (Updated!)

```bash
POST /api/apps/app-xyz/notifications/send
# This request is now rejected

# Response:
{
  "success": false,
  "resp_msg": "Usage limit exceeded. Limit: 5000, Remaining: 0",
  "resp_code": 4020
}
```

---

## ✨ Key Advantages

### 1. **Zero Downtime**
```
Traditional: Change code → Build → Deploy → Restart → 10 min downtime
With API:    Click button → 100ms database update → Live immediately
```

### 2. **Quick Promotions**
```bash
# Friday 5 PM: Set 2x limits for weekend
curl -X PUT /api/admin/plans/plan-pro/limits/batch \
  -d '{ "updates": [
    { "metric": "emails_per_month", "limit_value": 200000 },
    { "metric": "contacts", "limit_value": 200000 }
  ]}'

# Monday 8 AM: Revert back
curl -X PUT /api/admin/plans/plan-pro/limits/batch \
  -d '{ "updates": [
    { "metric": "emails_per_month", "limit_value": 100000 },
    { "metric": "contacts", "limit_value": 100000 }
  ]}'
```

### 3. **Custom Enterprise Deals**
```bash
# Special deal: This customer gets 1M emails until June
curl -X POST /api/admin/accounts/customer-xyz/limit-override \
  -d '{
    "metric": "emails_per_month",
    "temporary_limit": 1000000,
    "expires_at": "2026-06-30T23:59:59Z",
    "reason": "Annual contract - custom tier"
  }'

# This customer's effective limit is now 1M, not their plan's 100K
# Override automatically expires on July 1st
```

### 4. **A/B Testing**
```bash
# Test: Give 10% of PRO users 2x limits
for each customer in test_group:
  curl -X POST /api/admin/accounts/{customer}/limit-override \
    -d '{
      "metric": "emails_per_month",
      "temporary_limit": 200000,
      "expires_at": "2026-04-26T23:59:59Z",
      "reason": "A/B test: Higher limits impact on retention"
    }'

# Track conversion & churn during period
# Remove after 30 days, analyze results
```

---

## 🔍 Enforcement Middleware Changes

**Before (Hardcoded):**
```typescript
const limit = subscription.plan.limits.find(l => l.metric === metric);
const remaining = limit.limit_value - used; // Fixed at startup
```

**After (Dynamic):**
```typescript
// Checks database every request
const effectiveLimit = await PlanManagementService.getEffectiveLimit(
  accountId,
  metric
);
// Gets override if exists AND not expired
// Otherwise gets plan limit
const remaining = effectiveLimit - used;
```

---

## 📊 Monitoring the Changes

### View All Changes
```bash
curl http://localhost:3000/api/admin/plans/plan-pro/limits/history \
  -H "Authorization: Bearer admin-token"

# Response shows:
[
  {
    "metric": "emails_per_month",
    "old_value": 100000,
    "new_value": 150000,
    "reason": "Q1 2026 tier adjustment",
    "changed_by": "billing@company.com",
    "changed_at": "2026-03-26T10:30:00Z"
  },
  { ... more changes ... }
]
```

### Dashboard Endpoint
```bash
curl http://localhost:3000/api/admin/dashboard/limits-usage \
  -H "Authorization: Bearer admin-token"

# Shows:
{
  "total_plans": 3,
  "limits_changed_today": 5,
  "active_overrides": 12,
  "plans": {
    "FREE": {
      "changes_this_week": 0,
      "most_changed_metric": null
    },
    "PRO": {
      "changes_this_week": 3,
      "most_changed_metric": "emails_per_month"
    }
  }
}
```

---

## ⚙️ Scheduled Jobs

### Cleanup Expired Overrides (Daily 2 AM)
```typescript
export const cleanupJob = {
  cron: '0 2 * * *', // Daily at 2 AM
  execute: async () => {
    const cleaned = await PlanManagementService.cleanupExpiredOverrides();
    console.log(`Cleaned ${cleaned} expired overrides`);

    // Notify affected customers
    await sendEmail({
      to: 'billing@company.com',
      subject: 'Limit Overrides Expired',
      body: `${cleaned} temporary limit overrides expired today`
    });
  }
};
```

---

## 🎯 Implementation Roadmap

```
Week 1: Database schemas + API endpoints
  ✅ Add LimitOverride and LimitChangeHistory tables
  ✅ Implement all 9 API endpoints
  ✅ Add admin authentication

Week 2: Integrate with enforcement
  ✅ Update PlanEnforcementMiddleware
  ✅ Add override checking
  ✅ Update response headers

Week 3: Testing & Monitoring
  ✅ Write tests for all endpoints
  ✅ Create admin dashboard
  ✅ Setup audit logging

Week 4: Go Live
  ✅ Deploy to production
  ✅ Train support team
  ✅ Setup alerts for limit changes
```

---

## 🔒 Security Considerations

1. **Admin-Only Access**
   - All management endpoints require `admin` role
   - Audit all changes (already built in)

2. **Rate Limiting the Management API**
   ```typescript
   // Allow max 10 limit changes per minute (prevents bulk spam)
   fastify.register(require('@fastify/rate-limit'), {
     max: 10,
     timeWindow: '1 minute',
     redis: redisClient,
     keyGenerator: (request) => {
       return request.user.id; // Per-admin limit
     }
   });
   ```

3. **Changelog for Compliance**
   - All changes logged in LimitChangeHistory
   - Can satisfy audit requirements
   - Shows who changed what and when

---

## 📱 Admin Dashboard Example

```typescript
// React component for admins
function PlanLimitsManager() {
  const [plans, setPlans] = useState([]);
  const [editingLimit, setEditingLimit] = useState(null);

  async function updateLimit(planId, limitId, newValue, reason) {
    const response = await fetch(
      `/api/admin/plans/${planId}/limits/${limitId}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ limit_value: newValue, reason })
      }
    );

    // Live update without refresh!
    const updated = await response.json();
    alert(`✅ Limit updated! Changes live in ${updated.data.updated_at}`);
  }

  return (
    <div className="limits-manager">
      <h2>Plan Limits Management</h2>
      {plans.map(plan => (
        <PlanCard
          plan={plan}
          onLimitChange={(metric, value, reason) =>
            updateLimit(plan.id, metric, value, reason)
          }
        />
      ))}
    </div>
  );
}
```

---

## ✅ Testing the Integration

```typescript
// Integration test
describe('Plan Limits Management', () => {
  it('should update limit and immediately enforce it', async () => {
    // 1. Get current limit
    const oldLimit = await getPlanLimit('plan-free', 'emails');
    expect(oldLimit).toBe(1000);

    // 2. Update via API
    await adminApi.updateLimit('plan-free', 'emails', 5000);

    // 3. Verify enforcement uses new limit
    const user = await createUser('plan-free');
    await user.sendEmails(5000); // Should succeed
    const result = await user.sendEmail(); // Should fail
    expect(result.status).toBe(403);
    expect(result.body.resp_code).toBe(4020); // PLAN_LIMIT_EXCEEDED
  });

  it('should handle overrides correctly', async () => {
    // Set override: 1M for 30 days
    await adminApi.setOverride('account-123', 'emails', 1000000, 30);

    // Override should be active
    const user = getUser('account-123');
    const effective = await user.getEffectiveLimit('emails');
    expect(effective).toBe(1000000); // Override, not plan limit

    // After 30 days, should reset to plan limit
  });
});
```

---

## 🚀 Summary

✅ **Change limits anytime** without deployment
✅ **Per-account overrides** for enterprise customers
✅ **Automatic cleanup** of temporary changes
✅ **Full audit trail** for compliance
✅ **Real-time enforcement** - no caching needed
✅ **Admin-safe** - requires authentication & authorization

The system is **flexible enough** for any promotion or custom deal, while keeping the core enforcement **simple and fast**.

Generated: 2026-03-26

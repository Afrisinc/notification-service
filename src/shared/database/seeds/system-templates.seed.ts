import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USAGE_APPROACHING_LIMIT_TEMPLATE = {
  code: 'USAGE_APPROACHING_LIMIT',
  channel: 'EMAIL',
  category: 'TRANSACTIONAL',
  subject: 'Usage Alert: Approaching Your {{limitType}} Limit',
  content: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { padding: 20px; background: #ffc107; color: #333; }
    .title { font-size: 18px; font-weight: bold; margin: 0; }
    .content { padding: 20px; }
    .usage-bar { background: #e9ecef; border-radius: 4px; height: 20px; margin: 15px 0; }
    .usage-fill { background: #ffc107; height: 100%; border-radius: 4px; }
    .stats { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .footer { padding: 15px 20px; background: #f8f9fa; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Usage Alert: Approaching Limit</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Your account <strong>{{accountName}}</strong> is approaching its {{limitType}} limit.</p>
      <div class="usage-bar">
        <div class="usage-fill" style="width: {{usagePercent}}%"></div>
      </div>
      <div class="stats">
        <div class="stat-row">
          <span>Current Usage:</span>
          <span><strong>{{currentUsage}}</strong></span>
        </div>
        <div class="stat-row">
          <span>Limit:</span>
          <span><strong>{{limit}}</strong></span>
        </div>
        <div class="stat-row">
          <span>Usage:</span>
          <span><strong>{{usagePercent}}%</strong></span>
        </div>
      </div>
      <p>To avoid service interruption, please consider upgrading your plan or contact support.</p>
    </div>
    <div class="footer">
      This is an automated notification from Afrisinc Notification Service.
    </div>
  </div>
</body>
</html>
`,
  language: 'en',
  description: 'Notification when account approaches usage limit',
  visibility: 'private',
  is_public: false,
  requiredVariables: ['accountName', 'limitType', 'currentUsage', 'limit', 'usagePercent'],
};

const USAGE_LIMIT_EXCEEDED_TEMPLATE = {
  code: 'USAGE_LIMIT_EXCEEDED',
  channel: 'EMAIL',
  category: 'TRANSACTIONAL',
  subject: 'Action Required: {{limitType}} Limit Exceeded',
  content: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { padding: 20px; background: #dc3545; color: white; }
    .title { font-size: 18px; font-weight: bold; margin: 0; }
    .content { padding: 20px; }
    .alert-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .stats { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .footer { padding: 15px 20px; background: #f8f9fa; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Limit Exceeded</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <div class="alert-box">
        <strong>Your account {{accountName}} has exceeded its {{limitType}} limit.</strong>
        <p>New notifications may be blocked until your limit resets or you upgrade your plan.</p>
      </div>
      <div class="stats">
        <div class="stat-row">
          <span>Current Usage:</span>
          <span><strong>{{currentUsage}}</strong></span>
        </div>
        <div class="stat-row">
          <span>Limit:</span>
          <span><strong>{{limit}}</strong></span>
        </div>
        <div class="stat-row">
          <span>Overage:</span>
          <span><strong>{{overage}}</strong></span>
        </div>
        <div class="stat-row">
          <span>Resets:</span>
          <span><strong>{{resetDate}}</strong></span>
        </div>
      </div>
      <p>Please upgrade your plan or contact support immediately to restore service.</p>
    </div>
    <div class="footer">
      This is an automated notification from Afrisinc Notification Service.
    </div>
  </div>
</body>
</html>
`,
  language: 'en',
  description: 'Notification when account exceeds usage limit',
  visibility: 'private',
  is_public: false,
  requiredVariables: ['accountName', 'limitType', 'currentUsage', 'limit', 'overage', 'resetDate'],
};

const SYSTEM_ALERT_TEMPLATE = {
  code: 'SYSTEM_ALERT',
  channel: 'EMAIL',
  category: 'TRANSACTIONAL',
  subject: '[{{severity}}] {{title}}',
  content: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { padding: 20px; background: {{headerColor}}; color: white; }
    .header.critical { background: #dc3545; }
    .header.error { background: #fd7e14; }
    .header.warning { background: #ffc107; color: #333; }
    .header.info { background: #0d6efd; }
    .content { padding: 20px; }
    .alert-type { font-size: 12px; text-transform: uppercase; opacity: 0.8; margin-bottom: 5px; }
    .title { font-size: 18px; font-weight: bold; margin: 0; }
    .message { margin: 20px 0; line-height: 1.6; }
    .metadata { background: #f8f9fa; padding: 15px; border-radius: 4px; }
    .metadata-row { display: flex; margin-bottom: 8px; }
    .metadata-key { font-weight: bold; width: 150px; color: #666; }
    .metadata-value { flex: 1; }
    .footer { padding: 15px 20px; background: #f8f9fa; font-size: 12px; color: #666; text-align: center; }
    .timestamp { margin-top: 15px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header {{severity}}">
      <div class="alert-type">System Alert - {{alertType}}</div>
      <h1 class="title">{{title}}</h1>
    </div>
    <div class="content">
      <div class="message">{{message}}</div>
      {{#if metadata}}
      <div class="metadata">
        <strong>Details:</strong>
        {{#each metadata}}
        <div class="metadata-row">
          <span class="metadata-key">{{@key}}:</span>
          <span class="metadata-value">{{this}}</span>
        </div>
        {{/each}}
      </div>
      {{/if}}
      <div class="timestamp">Occurred at: {{timestamp}}</div>
    </div>
    <div class="footer">
      This is an automated system alert from Afrisinc Notification Service.
      <br>Do not reply to this email.
    </div>
  </div>
</body>
</html>
`,
  language: 'en',
  description: 'System alert template for admin notifications',
  visibility: 'private',
  is_public: false,
  requiredVariables: ['severity', 'title', 'message', 'alertType', 'timestamp'],
};

const ALL_TEMPLATES = [
  { template: SYSTEM_ALERT_TEMPLATE, envKey: 'SYSTEM_ALERT_TEMPLATE_ID' },
  { template: USAGE_APPROACHING_LIMIT_TEMPLATE, envKey: 'USAGE_APPROACHING_LIMIT_TEMPLATE_ID' },
  { template: USAGE_LIMIT_EXCEEDED_TEMPLATE, envKey: 'USAGE_LIMIT_EXCEEDED_TEMPLATE_ID' },
];

async function upsertTemplate(
  systemAccountId: string,
  systemUserId: string,
  template: typeof SYSTEM_ALERT_TEMPLATE
): Promise<string> {
  const existing = await prisma.template.findFirst({
    where: {
      account_id: systemAccountId,
      code: template.code,
      channel: template.channel as any,
    },
  });

  if (existing) {
    console.log(`Template ${template.code} already exists, updating...`);
    await prisma.template.update({
      where: { id: existing.id },
      data: {
        subject: template.subject,
        content: template.content,
        requiredVariables: template.requiredVariables,
        updatedAt: new Date(),
      },
    });
    return existing.id;
  }

  console.log(`Creating template ${template.code}...`);
  const created = await prisma.template.create({
    data: {
      account_id: systemAccountId,
      created_by_user_id: systemUserId,
      code: template.code,
      channel: template.channel as any,
      category: template.category as any,
      subject: template.subject,
      content: template.content,
      language: template.language,
      description: template.description,
      visibility: template.visibility as any,
      is_public: template.is_public,
      requiredVariables: template.requiredVariables,
    },
  });
  return created.id;
}

async function seedSystemTemplates() {
  const systemAccountId = process.env.SYSTEM_ACCOUNT_ID;

  if (!systemAccountId) {
    console.log('SYSTEM_ACCOUNT_ID required for system templates');
    console.log('Skipping system template seed');
    return;
  }

  // Get the account owner's user_id automatically
  const account = await prisma.account.findUnique({
    where: { id: systemAccountId },
  });

  if (!account) {
    console.log(`Account not found: ${systemAccountId}`);
    return;
  }

  const systemUserId = account.owner_user_id;
  console.log(`Using account owner as template creator: ${systemUserId}`);

  try {
    const results: Record<string, string> = {};

    for (const { template, envKey } of ALL_TEMPLATES) {
      const templateId = await upsertTemplate(systemAccountId, systemUserId, template);
      results[envKey] = templateId;
      console.log(`${template.code} template ready`);
    }

    console.log('\n========================================');
    console.log('Add these to your .env file:');
    console.log('========================================');
    for (const [key, value] of Object.entries(results)) {
      console.log(`${key}=${value}`);
    }
    console.log('========================================\n');
  } catch (error) {
    console.error('Failed to seed system templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedSystemTemplates()
  .then(() => console.log('System templates seed complete'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

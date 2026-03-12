import pino from 'pino';
import { prismaWrite } from '../config/prisma';

const logger = pino();
const prisma = prismaWrite;

interface TemplateDefinition {
  code: string;
  category: 'AUTH' | 'TRANSACTIONAL' | 'MARKETING' | 'NOTIFICATION';
  channel: 'EMAIL' | 'SMS';
  subject?: string;
  content: string;
  description: string;
  requiredVariables: string[];
}

/**
 * WELCOME_EMAIL - Welcome email template
 */
const WELCOME_EMAIL: TemplateDefinition = {
  code: 'WELCOME_EMAIL',
  category: 'TRANSACTIONAL',
  channel: 'EMAIL',
  subject: 'Welcome to Our Service',
  description: 'A friendly welcome email sent to new users',
  requiredVariables: ['user_name', 'company_name', 'cta_url'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 28px; margin: 0 0 16px 0; font-weight: bold;">Welcome, {{user_name}}!</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Thanks for signing up for <strong>{{company_name}}</strong>.</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">Click the button below to get started:</p>
  <a href="{{cta_url}}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 12px; font-weight: 500;">Get Started</a>
  <p style="margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">If you have any questions, please don't hesitate to reach out!</p>
</div>`,
};

/**
 * VERIFICATION_EMAIL - Email verification template
 */
const VERIFICATION_EMAIL: TemplateDefinition = {
  code: 'VERIFICATION_EMAIL',
  category: 'AUTH',
  channel: 'EMAIL',
  subject: 'Verify your email address',
  description: 'Email verification code template',
  requiredVariables: ['user_name', 'verification_code', 'verification_link'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0;">Verify Your Email</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{user_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">Please use the following code to verify your email:</p>
  <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; text-align: center;">
    <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">{{verification_code}}</span>
  </div>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Or click the link below:</p>
  <a href="{{verification_link}}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Verify Email</a>
</div>`,
};

/**
 * PASSWORD_RESET - Password reset template
 */
const PASSWORD_RESET: TemplateDefinition = {
  code: 'PASSWORD_RESET',
  category: 'AUTH',
  channel: 'EMAIL',
  subject: 'Reset your password',
  description: 'Password reset request email',
  requiredVariables: ['user_name', 'reset_link', 'expiry_hours'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0;">Password Reset Request</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{user_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">We received a request to reset your password. Click the link below to create a new password:</p>
  <a href="{{reset_link}}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 500;">Reset Password</a>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">This link expires in {{expiry_hours}} hours.</p>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">If you didn't request this, please ignore this email.</p>
</div>`,
};

/**
 * OTP_CODE - One-time password template
 */
const OTP_CODE: TemplateDefinition = {
  code: 'OTP_CODE',
  category: 'AUTH',
  channel: 'SMS',
  description: 'One-time password delivery via SMS',
  requiredVariables: ['otp_code', 'company_name'],
  content: "Your {{company_name}} verification code is: {{otp_code}}. Don't share this with anyone.",
};

/**
 * ORDER_CONFIRMATION - Order confirmation template
 */
const ORDER_CONFIRMATION: TemplateDefinition = {
  code: 'ORDER_CONFIRMATION',
  category: 'TRANSACTIONAL',
  channel: 'EMAIL',
  subject: 'Order Confirmation - {{order_id}}',
  description: 'Order confirmation email for e-commerce',
  requiredVariables: ['customer_name', 'order_id', 'order_total', 'tracking_url'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0;">Order Confirmed!</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{customer_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">Thank you for your order! Here are your details:</p>
  <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> {{order_id}}</p>
    <p style="margin: 0 0 8px 0;"><strong>Total:</strong> {{order_total}}</p>
  </div>
  <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">You'll receive a tracking number shortly.</p>
</div>`,
};

/**
 * PAYMENT_RECEIPT - Payment receipt template
 */
const PAYMENT_RECEIPT: TemplateDefinition = {
  code: 'PAYMENT_RECEIPT',
  category: 'TRANSACTIONAL',
  channel: 'EMAIL',
  subject: 'Payment Receipt - {{transaction_id}}',
  description: 'Payment confirmation receipt',
  requiredVariables: ['customer_name', 'amount', 'transaction_id', 'receipt_date'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0;">Payment Received</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{customer_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">We've received your payment. Here's your receipt:</p>
  <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> {{amount}}</p>
    <p style="margin: 0 0 8px 0;"><strong>Transaction ID:</strong> {{transaction_id}}</p>
    <p style="margin: 0;"><strong>Date:</strong> {{receipt_date}}</p>
  </div>
</div>`,
};

/**
 * NEWSLETTER - Newsletter template
 */
const NEWSLETTER: TemplateDefinition = {
  code: 'NEWSLETTER',
  category: 'MARKETING',
  channel: 'EMAIL',
  subject: "{{month}} Newsletter - What's New",
  description: 'Monthly newsletter template',
  requiredVariables: ['subscriber_name', 'month', 'cta_url'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0;">{{month}} Newsletter</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{subscriber_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">Check out what's new this month:</p>
  <a href="{{cta_url}}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: 500;">Read Latest Updates</a>
</div>`,
};

/**
 * SECURITY_ALERT - Security alert template
 */
const SECURITY_ALERT: TemplateDefinition = {
  code: 'SECURITY_ALERT',
  category: 'NOTIFICATION',
  channel: 'EMAIL',
  subject: '⚠️ Security Alert',
  description: 'Security alert notification',
  requiredVariables: ['user_name', 'alert_message', 'action_url'],
  content: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #dc2626;">Security Alert</h1>
  <p style="margin: 0 0 12px 0; line-height: 1.6;">Hi {{user_name}},</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;"><strong>{{alert_message}}</strong></p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">If this wasn't you, please secure your account immediately:</p>
  <a href="{{action_url}}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Review Activity</a>
</div>`,
};

/**
 * NOTIFICATION_ALERT - Notification alert template (SMS)
 */
const NOTIFICATION_ALERT: TemplateDefinition = {
  code: 'NOTIFICATION_ALERT',
  category: 'NOTIFICATION',
  channel: 'SMS',
  description: 'Notification alert via SMS',
  requiredVariables: ['message', 'action_url'],
  content: 'Alert: {{message}} - View details: {{action_url}}',
};

async function seedAllTemplates() {
  try {
    logger.info('🚀 Starting template seed...');

    // Get or create a system user for template creation
    const systemUser = await prisma.user.upsert({
      where: { email: 'system@afrisinc.com' },
      update: {},
      create: {
        email: 'system@afrisinc.com',
        password_hash: 'system',
        firstName: 'System',
        lastName: 'Admin',
        status: 'ACTIVE',
      },
    });

    // Get or create Afrisinc organization account
    const organization = await prisma.organization.upsert({
      where: { id: 'afrisinc-notify-org' },
      update: {},
      create: {
        id: 'afrisinc-notify-org',
        name: 'Afrisinc Notification System',
        country: 'NG',
      },
    });

    const afriincAccount = await prisma.account.upsert({
      where: { id: 'afrisinc-notify-account' },
      update: {},
      create: {
        id: 'afrisinc-notify-account',
        type: 'ORGANIZATION',
        owner_user_id: systemUser.id,
        organization_id: organization.id,
      },
    });

    logger.info({ accountId: afriincAccount.id }, 'Account ready for seeding');

    // Template definitions array
    const templates: TemplateDefinition[] = [
      WELCOME_EMAIL,
      VERIFICATION_EMAIL,
      PASSWORD_RESET,
      OTP_CODE,
      ORDER_CONFIRMATION,
      PAYMENT_RECEIPT,
      NEWSLETTER,
      SECURITY_ALERT,
      NOTIFICATION_ALERT,
    ];

    // Upsert all templates
    for (const template of templates) {
      try {
        const requiredVars = template.requiredVariables.map((v) => ({ name: v, required: true }));

        await prisma.template.upsert({
          where: {
            account_id_code_channel_language: {
              account_id: afriincAccount.id,
              code: template.code,
              channel: template.channel,
              language: 'en',
            },
          },
          update: {
            subject: template.subject,
            content: template.content,
            description: template.description,
            requiredVariables: requiredVars,
            active: true,
            category: template.category,
          },
          create: {
            code: template.code,
            channel: template.channel,
            subject: template.subject,
            content: template.content,
            description: template.description,
            active: true,
            category: template.category,
            requiredVariables: requiredVars,
            account_id: afriincAccount.id,
            created_by_user_id: systemUser.id,
          },
        });

        logger.info({ code: template.code, accountId: afriincAccount.id }, `✅ Seeded template: ${template.code}`);
      } catch (error) {
        logger.error({ error, code: template.code }, `❌ Failed to seed template: ${template.code}`);
        throw error;
      }
    }

    logger.info({ accountId: afriincAccount.id, count: templates.length }, '✅ All templates seeded successfully');

    return afriincAccount;
  } catch (error) {
    logger.error(error, '❌ Error seeding templates');
    throw error;
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedAllTemplates()
    .then(() => {
      logger.info('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error, '❌ Seeding failed');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export default seedAllTemplates;

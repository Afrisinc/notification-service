import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const prisma = new PrismaClient();
const logger = pino();

interface TemplateDefinition {
  code: string;
  category: 'AUTH';
  subject: string;
  content: string;
  description: string;
  requiredVariables: string[];
}

// Brand colors
const BRAND_PRIMARY = '#0F172A';
const BRAND_ACCENT = '#2563EB';
const BRAND_LIGHT = '#F8FAFC';
const BRAND_GRAY = '#64748B';

/**
 * AUTH_VERIFY_EMAIL - Email verification template
 */
const AUTH_VERIFY_EMAIL: TemplateDefinition = {
  code: 'AUTH_VERIFY_EMAIL',
  category: 'AUTH',
  subject: 'Verify your email address',
  description: 'Email verification for new account registration',
  requiredVariables: ['firstName', 'verificationUrl', 'companyName', 'supportEmail'],
  content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr style="background-color: ${BRAND_PRIMARY};">
            <td align="center" style="padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">{{companyName}}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: ${BRAND_PRIMARY}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Welcome, {{firstName}}!</h2>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">Thank you for creating your account with {{companyName}}. Please verify your email address to get started.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="{{verificationUrl}}" style="display: inline-block; background-color: ${BRAND_ACCENT}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s;">
                  Verify Email Address
                </a>
              </div>

              <p style="color: ${BRAND_GRAY}; margin: 24px 0; font-size: 14px; line-height: 1.6;">
                <strong>This link expires in 24 hours.</strong> If you did not create this account, please ignore this email.
              </p>

              <div style="background-color: ${BRAND_LIGHT}; border-left: 4px solid ${BRAND_ACCENT}; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: ${BRAND_PRIMARY}; margin: 0; font-size: 14px; font-weight: 500;">Can't click the button?</p>
                <p style="color: ${BRAND_GRAY}; margin: 8px 0 0 0; font-size: 13px; word-break: break-all;">
                  Copy and paste this link: <a href="{{verificationUrl}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">{{verificationUrl}}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background-color: ${BRAND_LIGHT}; border-top: 1px solid #e2e8f0;">
            <td style="padding: 32px 40px; text-align: center;">
              <p style="color: ${BRAND_GRAY}; margin: 0 0 12px 0; font-size: 13px;">
                Need help? <a href="mailto:{{supportEmail}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">Contact Support</a>
              </p>
              <p style="color: #cbd5e1; margin: 0; font-size: 12px;">
                © {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

/**
 * AUTH_PASSWORD_RESET - Password reset template
 */
const AUTH_PASSWORD_RESET: TemplateDefinition = {
  code: 'AUTH_PASSWORD_RESET',
  category: 'AUTH',
  subject: 'Reset your password',
  description: 'Password reset request email',
  requiredVariables: ['firstName', 'resetUrl', 'companyName', 'supportEmail'],
  content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr style="background-color: ${BRAND_PRIMARY};">
            <td align="center" style="padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">{{companyName}}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: ${BRAND_PRIMARY}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Reset Your Password</h2>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">We received a request to reset the password for your {{companyName}} account. Click the button below to create a new password.</p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="{{resetUrl}}" style="display: inline-block; background-color: ${BRAND_ACCENT}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s;">
                  Reset Password
                </a>
              </div>

              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">⚠️ Security Notice</p>
                <p style="color: #7f1d1d; margin: 0; font-size: 14px; line-height: 1.6;">
                  This link expires in 1 hour. If you didn't request a password reset, please ignore this email or contact support immediately.
                </p>
              </div>

              <div style="background-color: ${BRAND_LIGHT}; border-left: 4px solid ${BRAND_ACCENT}; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: ${BRAND_PRIMARY}; margin: 0; font-size: 14px; font-weight: 500;">Can't click the button?</p>
                <p style="color: ${BRAND_GRAY}; margin: 8px 0 0 0; font-size: 13px; word-break: break-all;">
                  Copy and paste this link: <a href="{{resetUrl}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">{{resetUrl}}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background-color: ${BRAND_LIGHT}; border-top: 1px solid #e2e8f0;">
            <td style="padding: 32px 40px; text-align: center;">
              <p style="color: ${BRAND_GRAY}; margin: 0 0 12px 0; font-size: 13px;">
                Need help? <a href="mailto:{{supportEmail}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">Contact Support</a>
              </p>
              <p style="color: #cbd5e1; margin: 0; font-size: 12px;">
                © {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

/**
 * AUTH_LOGIN_OTP - One-Time Password for login
 */
const AUTH_LOGIN_OTP: TemplateDefinition = {
  code: 'AUTH_LOGIN_OTP',
  category: 'AUTH',
  subject: 'Your login verification code',
  description: 'One-time password for login verification',
  requiredVariables: ['firstName', 'otpCode', 'expiryMinutes', 'companyName'],
  content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr style="background-color: ${BRAND_PRIMARY};">
            <td align="center" style="padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">{{companyName}}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: ${BRAND_PRIMARY}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Your Verification Code</h2>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 32px 0; font-size: 16px; line-height: 1.6;">Hi {{firstName}}, use the code below to complete your login:</p>

              <!-- OTP Code Box -->
              <div style="background-color: ${BRAND_LIGHT}; border: 2px solid ${BRAND_ACCENT}; padding: 24px; margin: 32px 0; border-radius: 8px; text-align: center;">
                <p style="color: ${BRAND_GRAY}; margin: 0 0 12px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                <p style="color: ${BRAND_PRIMARY}; margin: 0; font-size: 40px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">{{otpCode}}</p>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong>Expires in {{expiryMinutes}} minutes.</strong> Don't share this code with anyone.
                </p>
              </div>

              <p style="color: ${BRAND_GRAY}; margin: 24px 0; font-size: 14px; line-height: 1.6;">
                If you didn't request this code, someone may be trying to access your account. Please change your password immediately if you suspect unauthorized access.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background-color: ${BRAND_LIGHT}; border-top: 1px solid #e2e8f0;">
            <td style="padding: 32px 40px; text-align: center;">
              <p style="color: #cbd5e1; margin: 0; font-size: 12px;">
                © {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

/**
 * AUTH_ACCOUNT_LOCKED - Account locked notification
 */
const AUTH_ACCOUNT_LOCKED: TemplateDefinition = {
  code: 'AUTH_ACCOUNT_LOCKED',
  category: 'AUTH',
  subject: 'Your account has been locked',
  description: 'Account lock notification due to suspicious activity',
  requiredVariables: ['firstName', 'unlockUrl', 'supportEmail', 'companyName'],
  content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Locked</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr style="background-color: #ef4444;">
            <td align="center" style="padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🔒 Account Locked</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #991b1b; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Your {{companyName}} Account is Locked</h2>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 16px 0; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">We detected suspicious activity on your account and have temporarily locked it for your protection. This typically happens after multiple failed login attempts.</p>

              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">⚠️ What Happened?</p>
                <ul style="color: #7f1d1d; margin: 8px 0 0 0; font-size: 14px; padding-left: 20px;">
                  <li style="margin-bottom: 6px;">Multiple failed login attempts detected</li>
                  <li style="margin-bottom: 6px;">Account temporarily locked for security</li>
                  <li>You can unlock your account using the button below</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="{{unlockUrl}}" style="display: inline-block; background-color: ${BRAND_ACCENT}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s;">
                  Unlock My Account
                </a>
              </div>

              <p style="color: ${BRAND_GRAY}; margin: 24px 0; font-size: 14px; line-height: 1.6;">
                If this wasn't you, please change your password immediately and contact our support team right away.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background-color: ${BRAND_LIGHT}; border-top: 1px solid #e2e8f0;">
            <td style="padding: 32px 40px; text-align: center;">
              <p style="color: ${BRAND_GRAY}; margin: 0 0 12px 0; font-size: 13px;">
                Questions? <a href="mailto:{{supportEmail}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">Contact Support</a>
              </p>
              <p style="color: #cbd5e1; margin: 0; font-size: 12px;">
                © {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

/**
 * AUTH_NEW_DEVICE_LOGIN - New device login detected
 */
const AUTH_NEW_DEVICE_LOGIN: TemplateDefinition = {
  code: 'AUTH_NEW_DEVICE_LOGIN',
  category: 'AUTH',
  subject: 'New device login detected',
  description: 'Notification of login from a new or unrecognized device',
  requiredVariables: ['firstName', 'device', 'location', 'ipAddress', 'companyName', 'supportEmail'],
  content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Device Login</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr style="background-color: ${BRAND_PRIMARY};">
            <td align="center" style="padding: 40px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">{{companyName}}</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: ${BRAND_PRIMARY}; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">New Device Login Detected</h2>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>

              <p style="color: ${BRAND_GRAY}; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">We detected a login to your {{companyName}} account from a new device. Here are the details:</p>

              <!-- Device Information -->
              <div style="background-color: ${BRAND_LIGHT}; border: 1px solid #e2e8f0; padding: 20px; margin: 24px 0; border-radius: 8px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                      <p style="color: ${BRAND_PRIMARY}; margin: 0; font-weight: 600; font-size: 14px;">Device</p>
                    </td>
                    <td style="padding: 8px 0 8px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                      <p style="color: ${BRAND_GRAY}; margin: 0; font-size: 14px;">{{device}}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                      <p style="color: ${BRAND_PRIMARY}; margin: 0; font-weight: 600; font-size: 14px;">Location</p>
                    </td>
                    <td style="padding: 8px 0 8px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                      <p style="color: ${BRAND_GRAY}; margin: 0; font-size: 14px;">{{location}}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="color: ${BRAND_PRIMARY}; margin: 0; font-weight: 600; font-size: 14px;">IP Address</p>
                    </td>
                    <td style="padding: 8px 0 0 16px; text-align: right;">
                      <p style="color: ${BRAND_GRAY}; margin: 0; font-size: 14px;">{{ipAddress}}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #dbeafe; border-left: 4px solid ${BRAND_ACCENT}; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">ℹ️ Recognized this device?</p>
                <p style="color: #1e3a8a; margin: 0; font-size: 14px; line-height: 1.6;">
                  If this was you, no action is needed. Your account is secure.
                </p>
              </div>

              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">⚠️ Didn't recognize this?</p>
                <p style="color: #7f1d1d; margin: 0; font-size: 14px; line-height: 1.6;">
                  If you don't recognize this login, your account may be compromised. Secure your account immediately by changing your password and enable two-factor authentication.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background-color: ${BRAND_LIGHT}; border-top: 1px solid #e2e8f0;">
            <td style="padding: 32px 40px; text-align: center;">
              <p style="color: ${BRAND_GRAY}; margin: 0 0 12px 0; font-size: 13px;">
                Need help? <a href="mailto:{{supportEmail}}" style="color: ${BRAND_ACCENT}; text-decoration: none;">Contact Support</a>
              </p>
              <p style="color: #cbd5e1; margin: 0; font-size: 12px;">
                © {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
};

/**
 * Seed templates for Afrisinc system tenant
 */
export async function seedAuthTemplates() {
  try {
    // Find or create Afrisinc system tenant
    let afriincTenant = await prisma.tenant.findUnique({
      where: { code: 'afrisinc-auth' },
    });

    if (!afriincTenant) {
      logger.info('Creating Afrisinc system tenant...');
      afriincTenant = await prisma.tenant.create({
        data: {
          code: 'afrisinc-auth',
          name: 'Afrisinc Auth',
          accountId: 'system-afrisinc',
          accountType: 'ORGANIZATION',
          status: 'ACTIVE',
        },
      });
      logger.info({ tenantId: afriincTenant.id }, '✅ Afrisinc tenant created');
    }

    // Template definitions
    const templates: TemplateDefinition[] = [
      AUTH_VERIFY_EMAIL,
      AUTH_PASSWORD_RESET,
      AUTH_LOGIN_OTP,
      AUTH_ACCOUNT_LOCKED,
      AUTH_NEW_DEVICE_LOGIN,
    ];

    // Upsert all templates
    for (const template of templates) {
      try {
        const requiredVars = template.requiredVariables.map((v) => ({ name: v, required: true }));

        await prisma.template.upsert({
          where: {
            tenantId_code_channel_language: {
              tenantId: afriincTenant.id,
              code: template.code,
              channel: 'EMAIL',
              language: 'en',
            },
          },
          update: {
            subject: template.subject,
            content: template.content,
            description: template.description,
            requiredVariables: requiredVars,
            active: true,
            version: 1,
            category: 'AUTH',
          },
          create: {
            code: template.code,
            channel: 'EMAIL',
            subject: template.subject,
            content: template.content,
            description: template.description,
            language: 'en',
            version: 1,
            active: true,
            category: 'AUTH',
            requiredVariables: requiredVars,
            tenantId: afriincTenant.id,
          },
        });

        logger.info({ code: template.code, tenantId: afriincTenant.id }, `✅ Seeded template: ${template.code}`);
      } catch (error) {
        logger.error({ error, code: template.code }, `❌ Failed to seed template: ${template.code}`);
        throw error;
      }
    }

    logger.info({ tenantId: afriincTenant.id, count: templates.length }, '✅ All AUTH templates seeded successfully');

    return afriincTenant;
  } catch (error) {
    logger.error(error, '❌ Error seeding AUTH templates');
    throw error;
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedAuthTemplates()
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

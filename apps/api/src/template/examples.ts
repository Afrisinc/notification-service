/**
 * Template System Examples
 * Comprehensive examples of templates for all supported channels
 * These can be used as reference for creating templates via the API
 */

/**
 * EMAIL Template Example
 * HTML-based email with subject and content
 * Supports: subject, content with HTML
 * Variables: user.name, user.email, appName, verificationLink, validityHours
 */
export const WELCOME_EMAIL_TEMPLATE = {
  code: "WELCOME_EMAIL",
  channel: "EMAIL",
  language: "en",
  subject: "Welcome to {{appName}}, {{user.name}}!",
  content: `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; font-size: 12px; color: #999; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to {{appName}}</h1>
          </div>
          <div class="content">
            <p>Hello {{user.name}},</p>
            <p>Thank you for joining {{appName}}! We're excited to have you on board.</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li>Email: {{user.email}}</li>
              <li>Registered on: {{date createdDate 'DATETIME'}}</li>
            </ul>
            <p>Please verify your email address by clicking the button below:</p>
            <p><a href="{{verificationLink}}" class="button">Verify Email</a></p>
            <p><em>This link will expire in {{validityHours}} hours.</em></p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; {{currentYear}} {{appName}}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `,
  description: "Welcome email sent to new users with email verification link",
  requiredVariables: [
    "appName",
    "user.name",
    "user.email",
    "verificationLink",
    "validityHours",
    "createdDate",
    "currentYear",
  ],
};

/**
 * SMS Template Example
 * Plain text SMS message (160-200 characters recommended)
 * Variables: appName, otp, validityMinutes
 */
export const OTP_SMS_TEMPLATE = {
  code: "OTP_SMS",
  channel: "SMS",
  language: "en",
  content:
    "Your {{appName}} verification code is: {{otp}}. Valid for {{validityMinutes}} minutes. Never share this code.",
  description: "One-Time Password verification SMS",
  requiredVariables: ["appName", "otp", "validityMinutes"],
};

/**
 * PUSH Notification Template Example
 * Push notification for mobile apps
 * Variables: orderNumber, trackingUrl, estimatedDelivery
 */
export const ORDER_SHIPPED_PUSH_TEMPLATE = {
  code: "ORDER_SHIPPED",
  channel: "PUSH",
  language: "en",
  content:
    "Your order #{{orderNumber}} has shipped! 📦 Track it here: {{trackingUrl}} - Arriving {{estimatedDelivery}}",
  description: "Push notification when customer order is shipped",
  requiredVariables: ["orderNumber", "trackingUrl", "estimatedDelivery"],
};

/**
 * IN_APP Notification Template Example
 * In-application notification/toast message
 * Variables: sender.name, message.preview, messageUrl
 */
export const NEW_MESSAGE_INAPP_TEMPLATE = {
  code: "NEW_MESSAGE",
  channel: "IN_APP",
  language: "en",
  content:
    "{{sender.name}} sent you a message: {{message.preview}}... {{#if hasAttachment}}📎 with attachment{{/if}}",
  description: "In-app notification for new user messages",
  requiredVariables: ["sender.name", "message.preview", "hasAttachment"],
};

/**
 * WHATSAPP Template Example
 * WhatsApp Business API message
 * Variables: patient.name, appointment.date, appointment.time, doctor.name, clinicName
 */
export const APPOINTMENT_REMINDER_WHATSAPP_TEMPLATE = {
  code: "APPOINTMENT_REMINDER",
  channel: "WHATSAPP",
  language: "en",
  content: `Hi {{patient.name}}, 👋

This is a reminder for your appointment:

📅 Date: {{appointment.date}}
⏰ Time: {{appointment.time}}
👨‍⚕️ Doctor: Dr. {{doctor.name}}
🏥 Clinic: {{clinicName}}

Please arrive 10 minutes early. If you need to reschedule, reply with RESCHEDULE.

Thank you!`,
  description: "WhatsApp appointment reminder for patients",
  requiredVariables: [
    "patient.name",
    "appointment.date",
    "appointment.time",
    "doctor.name",
    "clinicName",
  ],
};

/**
 * Example API Request: Create Welcome Email Template
 */
export const CREATE_WELCOME_EMAIL_REQUEST = {
  code: "WELCOME_EMAIL",
  channel: "EMAIL",
  subject: "Welcome to {{appName}}, {{user.name}}!",
  content: `<html><body><h1>Welcome {{user.name}}!</h1><p>Thank you for joining {{appName}}.</p><a href="{{verificationLink}}">Verify Email</a></body></html>`,
  language: "en",
  description: "Welcome email with email verification",
};

/**
 * Example API Response: Template Created
 */
export const CREATE_TEMPLATE_RESPONSE = {
  success: true,
  resp_msg: "Template created successfully",
  resp_code: 1001,
  data: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    code: "WELCOME_EMAIL",
    channel: "EMAIL",
    active: true,
  },
};

/**
 * Example API Request: Preview Template
 */
export const PREVIEW_TEMPLATE_REQUEST = {
  templateCode: "WELCOME_EMAIL",
  channel: "EMAIL",
  locale: "en",
  variables: {
    appName: "Afrisinc Notify",
    user: {
      name: "John Doe",
      email: "john.doe@example.com",
    },
    verificationLink: "https://app.example.com/verify/abc123",
    validityHours: 24,
    createdDate: "2025-02-09T18:30:00Z",
    currentYear: 2025,
  },
};

/**
 * Example API Response: Template Preview
 */
export const PREVIEW_TEMPLATE_RESPONSE = {
  success: true,
  resp_msg: "Template rendered successfully",
  resp_code: 1000,
  data: {
    subject: "Welcome to Afrisinc Notify, John Doe!",
    content: `<html>...<h1>Welcome John Doe!</h1>...<a href="https://app.example.com/verify/abc123">Verify Email</a>...</html>`,
    locale: "en",
    version: 1,
  },
};

/**
 * Example API Request: Create New Template Version
 */
export const CREATE_VERSION_REQUEST = {
  subject: "Welcome to {{appName}}, {{user.name}}! (Updated)",
  content: `<html><body><h1>Welcome {{user.name}}!</h1><p>Thank you for choosing {{appName}}.</p><p>Please verify your email: <a href="{{verificationLink}}">Verify Now</a></p></body></html>`,
  createdBy: "admin@example.com",
};

/**
 * Example API Response: Version Created
 */
export const CREATE_VERSION_RESPONSE = {
  success: true,
  resp_msg: "Template version created successfully",
  resp_code: 1001,
  data: {
    id: "660e8400-e29b-41d4-a716-446655440001",
    version: 2,
    isActive: false,
    createdAt: "2025-02-09T19:45:00Z",
  },
};

/**
 * Example API Request: Activate Template Version
 */
export const ACTIVATE_VERSION_REQUEST = {
  // No body - all parameters in URL: /templates/:id/versions/:versionId/activate
};

/**
 * Example API Response: Version Activated
 */
export const ACTIVATE_VERSION_RESPONSE = {
  success: true,
  resp_msg: "Template version activated successfully",
  resp_code: 1000,
  data: {
    id: "660e8400-e29b-41d4-a716-446655440001",
    version: 2,
    isActive: true,
    createdAt: "2025-02-09T19:45:00Z",
  },
};

/**
 * Handlebars Helpers Available
 * - {{date timestamp 'FORMAT'}} - Format dates (ISO, DATE, TIME, DATETIME)
 * - {{uppercase text}} - Convert to uppercase
 * - {{lowercase text}} - Convert to lowercase
 * - {{truncate text length}} - Truncate text with ellipsis
 * - {{default value fallback}} - Provide fallback values
 * - {{#if condition}}...{{/if}} - Conditional blocks
 * - {{#each array}}...{{/each}} - Loop over arrays
 */

/**
 * Template Variables Best Practices
 * 1. Use dot notation for nested objects: {{user.profile.name}}
 * 2. Use array indices carefully: {{items.[0].name}}
 * 3. Provide all required variables when rendering
 * 4. Use meaningful variable names for clarity
 * 5. Document required variables in template description
 * 6. Test templates with preview endpoint before using
 */

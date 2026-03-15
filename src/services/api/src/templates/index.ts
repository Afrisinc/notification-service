/**
 * Default Fallback Email Templates
 * These templates are used when database templates are not found or not provided
 * Each template supports Handlebars syntax for variable substitution
 */

export interface DefaultTemplate {
  code: string;
  name: string;
  description: string;
  channel: 'EMAIL';
  html: string;
  requiredVariables: string[];
}

export const DEFAULT_TEMPLATES: Record<string, DefaultTemplate> = {
  WELCOME: {
    code: 'WELCOME',
    name: 'Welcome Email',
    description: 'Welcome message for new users',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to AfrisInc</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 2px solid #007bff;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
        }
        .content {
            padding: 30px 0;
        }
        .greeting {
            font-size: 20px;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
        .highlight {
            background-color: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">AfrisInc</div>
        </div>

        <div class="content">
            <div class="greeting">Welcome, {{userName}}!</div>

            <p class="body-text">
                Thank you for joining AfrisInc. We're excited to have you on board!
            </p>

            <p class="body-text">
                Your account has been successfully created and is ready to use. Explore our platform and discover all the features we have to offer.
            </p>

            <div class="highlight">
                <strong>Account Details:</strong><br>
                Email: {{userEmail}}<br>
                Account Created: {{createdDate}}
            </div>

            <p class="body-text">
                <a href="{{dashboardUrl}}" class="cta-button">Get Started</a>
            </p>

            <p class="body-text">
                If you have any questions or need assistance, our support team is here to help.
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'userEmail', 'createdDate', 'dashboardUrl'],
  },

  SUCCESSFUL_REGISTRATION: {
    code: 'SUCCESSFUL_REGISTRATION',
    name: 'Registration Successful',
    description: 'Confirmation email for successful user registration',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registration Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px 0;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .info-box {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .next-steps {
            background-color: #e7f3ff;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .next-steps h3 {
            margin-top: 0;
            color: #007bff;
        }
        .next-steps ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .next-steps li {
            margin: 8px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✓</div>
            <div class="title">Registration Successful!</div>
        </div>

        <div class="content">
            <p class="body-text">
                Hello {{userName}},
            </p>

            <p class="body-text">
                Congratulations! Your registration with AfrisInc has been completed successfully. Your account is now active and ready to use.
            </p>

            <div class="info-box">
                <strong>Account Information:</strong><br>
                Email: {{userEmail}}<br>
                Username: {{username}}<br>
                Registration Date: {{registrationDate}}
            </div>

            <a href="{{dashboardUrl}}" class="cta-button">Access Your Account</a>

            <div class="next-steps">
                <h3>Next Steps:</h3>
                <ul>
                    <li>Complete your profile information</li>
                    <li>Set up your preferences</li>
                    <li>Explore our features and tools</li>
                    <li>Join our community</li>
                </ul>
            </div>

            <p class="body-text">
                If you did not create this account, please contact our support team immediately.
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'userEmail', 'username', 'registrationDate', 'dashboardUrl'],
  },

  RESET_PASSWORD: {
    code: 'RESET_PASSWORD',
    name: 'Password Reset',
    description: 'Password reset link for users who requested it',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 2px solid #ff9800;
        }
        .warning-icon {
            font-size: 40px;
            margin-bottom: 15px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #ff9800;
        }
        .content {
            padding: 30px 0;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #ff9800;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .warning-box {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #856404;
        }
        .expiry-info {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .expiry-info strong {
            color: #dc3545;
        }
        .security-tips {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .security-tips h3 {
            margin-top: 0;
            color: #1976d2;
        }
        .security-tips ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .security-tips li {
            margin: 8px 0;
            font-size: 14px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="warning-icon">🔐</div>
            <div class="title">Password Reset Request</div>
        </div>

        <div class="content">
            <p class="body-text">
                Hello {{userName}},
            </p>

            <p class="body-text">
                We received a request to reset the password for your AfrisInc account. Click the button below to set a new password.
            </p>

            <a href="{{resetLink}}" class="cta-button">Reset Password</a>

            <div class="expiry-info">
                <p>This link will expire in: <strong>{{expiryTime}}</strong></p>
                <p style="font-size: 12px; margin: 10px 0 0 0;">For security reasons, please reset your password as soon as possible.</p>
            </div>

            <div class="warning-box">
                <strong>Important Security Notice:</strong><br>
                If you did not request a password reset, please ignore this email or contact our support team immediately. Do not share this link with anyone.
            </div>

            <div class="security-tips">
                <h3>Security Tips for Your New Password:</h3>
                <ul>
                    <li>Use a combination of uppercase, lowercase, numbers, and symbols</li>
                    <li>Make it at least 12 characters long</li>
                    <li>Avoid using personal information like your name or birthdate</li>
                    <li>Never reuse old passwords</li>
                    <li>Use a unique password for this account</li>
                </ul>
            </div>

            <p class="body-text">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <code style="background-color: #f5f5f5; padding: 2px 6px; border-radius: 3px;">{{resetLink}}</code>
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'resetLink', 'expiryTime'],
  },

  FORGOT_PASSWORD: {
    code: 'FORGOT_PASSWORD',
    name: 'Account Recovery',
    description: 'Account recovery email with verification code',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Recovery</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
        }
        .recovery-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #d9534f;
        }
        .subtitle {
            color: #999;
            margin-top: 10px;
            font-size: 14px;
        }
        .content {
            padding: 30px 0;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #d9534f;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .recovery-options {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .recovery-options h3 {
            margin-top: 0;
            color: #333;
        }
        .option {
            margin: 15px 0;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
        }
        .option:last-child {
            border-bottom: none;
        }
        .option-title {
            font-weight: 600;
            color: #d9534f;
            margin-bottom: 5px;
        }
        .verification-code {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .verification-code .label {
            font-size: 12px;
            color: #856404;
            margin-bottom: 10px;
        }
        .verification-code .code {
            font-size: 24px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            color: #333;
        }
        .security-notice {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            border-left: 4px solid #f5c6cb;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #721c24;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="recovery-icon">🔑</div>
            <div class="title">Account Recovery</div>
            <div class="subtitle">Password Recovery Request</div>
        </div>

        <div class="content">
            <p class="body-text">
                Hello {{userName}},
            </p>

            <p class="body-text">
                We received a request to recover access to your AfrisInc account. We're here to help you regain access quickly and securely.
            </p>

            <div style="text-align: center;">
                <a href="{{recoveryLink}}" class="cta-button">Recover Your Account</a>
            </div>

            <div class="verification-code">
                <div class="label">Your Verification Code:</div>
                <div class="code">{{verificationCode}}</div>
                <div class="label" style="margin-top: 10px;">This code expires in {{expiryTime}}</div>
            </div>

            <div class="security-notice">
                <strong>Security Alert:</strong> If you did not request account recovery, please secure your account immediately by contacting our support team. Do not share this code with anyone.
            </div>

            <p class="body-text">
                Need additional help? Our support team is available 24/7 at support@afrisinc.com
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'recoveryLink', 'verificationCode', 'expiryTime'],
  },

  VERIFY_EMAIL: {
    code: 'VERIFY_EMAIL',
    name: 'Email Verification',
    description: 'Email verification request with verification code',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email Address</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 2px solid #17a2b8;
        }
        .verification-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #17a2b8;
        }
        .content {
            padding: 30px 0;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #17a2b8;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .code-box {
            background-color: #e8f4f8;
            border: 2px solid #17a2b8;
            border-radius: 4px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .code-label {
            font-size: 12px;
            color: #555;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .verification-code {
            font-size: 32px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 3px;
            color: #17a2b8;
            word-break: break-all;
        }
        .code-expiry {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
        }
        .instructions {
            background-color: #f0f7f8;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .instructions h3 {
            margin-top: 0;
            color: #17a2b8;
        }
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .instructions li {
            margin: 8px 0;
            line-height: 1.6;
        }
        .info-box {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="verification-icon">✉️</div>
            <div class="title">Verify Your Email Address</div>
        </div>

        <div class="content">
            <p class="body-text">
                Hello {{userName}},
            </p>

            <p class="body-text">
                Thank you for signing up with AfrisInc! To complete your account activation and ensure your email is valid, please verify your email address using one of the methods below.
            </p>

            <div class="code-box">
                <div class="code-label">Your Verification Code:</div>
                <div class="verification-code">{{verificationCode}}</div>
                <div class="code-expiry">Expires in: {{expiryTime}}</div>
            </div>

            <div style="text-align: center;">
                <a href="{{verificationLink}}" class="cta-button">Verify Email Now</a>
            </div>

            <div class="instructions">
                <h3>How to Verify:</h3>
                <ol>
                    <li><strong>Method 1:</strong> Click the button above to verify instantly</li>
                    <li><strong>Method 2:</strong> Go to our website and enter the code: <code style="background-color: #fff; padding: 2px 4px;">{{verificationCode}}</code></li>
                </ol>
            </div>

            <div class="info-box">
                <strong>Important:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>This verification code will expire in {{expiryTime}}</li>
                    <li>If the code expires, you can request a new one</li>
                    <li>Your account is temporarily restricted until verified</li>
                    <li>Once verified, you'll have full access to all features</li>
                </ul>
            </div>

            <p class="body-text">
                <strong>Didn't sign up?</strong> If you believe this email was sent in error, you can safely ignore it. Your email will not be verified.
            </p>

            <p class="body-text">
                Questions? Contact our support team at support@afrisinc.com
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'verificationCode', 'expiryTime', 'verificationLink'],
  },

  ACCOUNT_CONFIRMATION: {
    code: 'ACCOUNT_CONFIRMATION',
    name: 'Account Verified',
    description: 'Confirmation email after successful account verification',
    channel: 'EMAIL',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Verified</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 30px;
        }
        .success-badge {
            font-size: 60px;
            margin-bottom: 15px;
        }
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 16px;
            color: #666;
        }
        .content {
            padding: 30px 0;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .body-text {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .cta-button {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: 500;
        }
        .confirmation-details {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            border-left: 4px solid #28a745;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .confirmation-details h3 {
            margin-top: 0;
            color: #28a745;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #c3e6cb;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #155724;
        }
        .detail-value {
            color: #155724;
        }
        .next-steps {
            background-color: #e7f5ff;
            border-left: 4px solid #0066ff;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .next-steps h3 {
            margin-top: 0;
            color: #0066ff;
        }
        .next-steps ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .next-steps li {
            margin: 10px 0;
            line-height: 1.6;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-badge">🎉</div>
            <div class="title">Account Verified Successfully!</div>
            <div class="subtitle">Welcome to AfrisInc</div>
        </div>

        <div class="content">
            <div class="greeting">Welcome to the AfrisInc community, {{userName}}!</div>

            <p class="body-text">
                Excellent! Your email has been successfully verified and your account is now fully active. You have complete access to all features and services offered by AfrisInc.
            </p>

            <div class="confirmation-details">
                <h3>Account Confirmation Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">{{userEmail}}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">✓ Verified</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Verified On:</span>
                    <span class="detail-value">{{verificationDate}}</span>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="{{dashboardUrl}}" class="cta-button">Go to Dashboard</a>
            </div>

            <div class="next-steps">
                <h3>What You Can Do Now:</h3>
                <ul>
                    <li>Complete your profile and add a profile picture</li>
                    <li>Customize your account settings and preferences</li>
                    <li>Set up two-factor authentication for added security</li>
                    <li>Connect additional email addresses</li>
                    <li>Explore all available features</li>
                </ul>
            </div>

            <p class="body-text">
                Thank you for choosing AfrisInc. We're excited to have you on board!
            </p>
        </div>

        <div class="footer">
            <p>© 2025 AfrisInc. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`,
    requiredVariables: ['userName', 'userEmail', 'verificationDate', 'dashboardUrl'],
  },
};

/**
 * Get a default template by code
 */
export function getDefaultTemplate(code: string): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES[code];
}

/**
 * List all available default templates
 */
export function listDefaultTemplates(): DefaultTemplate[] {
  return Object.values(DEFAULT_TEMPLATES);
}

/**
 * Check if a template code exists in defaults
 */
export function hasDefaultTemplate(code: string): boolean {
  return code in DEFAULT_TEMPLATES;
}

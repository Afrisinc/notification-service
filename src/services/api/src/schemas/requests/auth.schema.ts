export type AccountType = 'personal' | 'company';

export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location?: string;
  password: string;
  account_type: AccountType;
  account_name?: string;
  plan?: 'FREE' | 'PRO' | 'ENTERPRISE';
  displayName?: string;
  organizationName: string;
  jobTitle?: string;
  industry?: string;
  companyEmail: string;
  companySize?: string;
  website?: string;
}

export const RegisterRequestSchema = {
  type: 'object',
  properties: {
    firstName: {
      type: 'string',
      description: 'User first name',
    },
    lastName: {
      type: 'string',
      description: 'User last name',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address for registration',
    },
    phone: {
      type: 'string',
      description: 'User phone number',
    },
    location: {
      type: 'string',
      description: 'User location/address (optional)',
    },
    password: {
      type: 'string',
      minLength: 6,
      description: 'User password (minimum 6 characters)',
    },
    account_type: {
      type: 'string',
      enum: ['personal', 'company'],
      description: 'Account type - "personal" or "company"',
    },
    account_name: {
      type: 'string',
      description: 'Account name (optional)',
    },
    plan: {
      type: 'string',
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      description: 'Subscription plan (optional, defaults to FREE)',
    },
    displayName: {
      type: 'string',
      description: 'Display name (optional)',
    },
    organizationName: {
      type: 'string',
      description: 'Organization name (required for company accounts)',
    },
    jobTitle: {
      type: 'string',
      description: 'Job title (optional)',
    },
    industry: {
      type: 'string',
      description: 'Industry (optional)',
    },
    companyEmail: {
      type: 'string',
      format: 'email',
      description: 'Company email (required for company accounts)',
    },
    companySize: {
      type: 'string',
      description: 'Company size (optional)',
    },
    website: {
      type: 'string',
      description: 'Website (optional)',
    },
  },
  required: ['firstName', 'lastName', 'email', 'password', 'account_type', 'phone'],
  additionalProperties: false,
} as const;

export const LoginRequestSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address for login',
    },
    password: {
      type: 'string',
      description: 'User password',
    },
    product_code: {
      type: 'string',
      description: 'Product code',
    },
  },
  required: ['email', 'password'],
  additionalProperties: false,
} as const;

export const ForgotPasswordRequestSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address to send reset instructions',
    },
  },
  required: ['email'],
  additionalProperties: false,
} as const;

export const ResetPasswordRequestSchema = {
  type: 'object',
  properties: {
    token: {
      type: 'string',
      description: 'Password reset token received via email or OTP',
    },
    newPassword: {
      type: 'string',
      minLength: 6,
      description: 'New password to set (minimum 6 characters)',
    },
  },
  required: ['token', 'newPassword'],
  additionalProperties: false,
} as const;

export const OAuthExchangeRequestSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Authorization code from login response',
    },
  },
  required: ['code'],
  additionalProperties: false,
} as const;

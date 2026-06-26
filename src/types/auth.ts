/**
 * Authentication type definitions
 * Shared across the application for type safety
 */

export type AccountType = 'personal' | 'company';

/**
 * Login request payload
 */
export interface LoginUserRequest {
  email: string;
  password: string;
  product_code?: string;
}

/**
 * Signup/Registration request payload
 */
export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location?: string;
  password: string;
  account_type: AccountType;
  account_name?: string;
  planId: string;
  billingCycle?: 'monthly' | 'annual';
  paymentMethodId?: string; // Stripe payment method ID (required for paid plans)
  customerId?: string; // Stripe cus_xxx — created during signup SetupIntent flow
  displayName?: string;
  organizationName: string;
  jobTitle?: string;
  industry?: string;
  companyEmail: string;
  companySize?: string;
  website?: string;
}

/**
 * JWT token payload
 */
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  type: 'base' | 'product';
  accountIds?: string[];
  productId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user_id: string;
  email: string;
  account_ids: string[];
  token: string;
  token_type: 'Bearer';
  expires_in: number;
}

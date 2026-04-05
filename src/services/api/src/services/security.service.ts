import { SecurityRepository } from '../repositories/identity-repositories/security.repository';

const securityRepo = new SecurityRepository();

export class SecurityService {
  async getSecurityOverview(options?: { range?: '24h' | '7d' | '30d'; limit?: number; failed_login_limit?: number }) {
    const range = options?.range || '24h';
    const limit = options?.limit || 5;
    const failed_login_limit = options?.failed_login_limit || 10;

    // Determine hours based on range
    const hoursMap: Record<string, number> = {
      '24h': 24,
      '7d': 7 * 24,
      '30d': 30 * 24,
    };

    if (!hoursMap[range]) {
      throw new Error('Invalid range parameter. Must be one of: 24h, 7d, 30d');
    }

    const hours = hoursMap[range];

    // Fetch all data in parallel
    const [failedLogins24h, tokenIssuanceCount, suspiciousActivity, topIPs, failedLogins] = await Promise.all([
      securityRepo.getFailedLoginsCount(hours),
      securityRepo.getTokenIssuanceCount(),
      securityRepo.detectSuspiciousActivity(hours),
      securityRepo.getTopIPs(hours, limit),
      securityRepo.getRecentFailedLogins(hours, failed_login_limit),
    ]);

    return {
      failedLogins24h,
      tokenIssuanceCount,
      suspiciousActivity,
      topIPs,
      failedLogins: failedLogins.map((login: any) => ({
        id: login.id,
        email: login.email,
        ip: login.ip_address,
        timestamp: login.createdAt.toISOString(),
        reason: login.failure_reason,
      })),
    };
  }

  async recordFailedLogin(data: {
    email: string;
    ip_address: string;
    failure_reason: string;
    user_id?: string;
    session_id?: string;
  }) {
    return securityRepo.createLoginFailure(data);
  }

  async issueToken(user_id: string, token_type: string = 'access', expiresIn?: number) {
    let expires_at: Date | undefined;
    if (expiresIn) {
      expires_at = new Date(Date.now() + expiresIn);
    }

    return securityRepo.createToken({
      user_id,
      token_type,
      expires_at,
    });
  }

  async revokeToken(token_id: string) {
    return securityRepo.revokeToken(token_id);
  }

  async getLoginEvents(options: { page: number; limit: number; search?: string; sortBy?: 'asc' | 'desc' }) {
    return securityRepo.getLoginEvents(options);
  }
}

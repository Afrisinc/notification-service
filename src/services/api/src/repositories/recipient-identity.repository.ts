import { prismaRead, prismaWrite } from '@shared/database';
import { logger } from '../config/logger';

export class RecipientIdentityRepository {
  static async findByEmail(email: string) {
    try {
      return await prismaRead.recipientIdentity.findUnique({ where: { email } });
    } catch (error) {
      logger.error({ error, email }, 'Failed to find recipient identity');
      throw error;
    }
  }

  static async findById(id: string) {
    try {
      return await prismaRead.recipientIdentity.findUnique({ where: { id } });
    } catch (error) {
      logger.error({ error, id }, 'Failed to find recipient identity by id');
      throw error;
    }
  }

  static async findOrCreate(email: string) {
    try {
      const existing = await prismaWrite.recipientIdentity.findUnique({ where: { email } });
      if (existing) return existing;
      return await prismaWrite.recipientIdentity.create({ data: { email } });
    } catch (error) {
      logger.error({ error, email }, 'Failed to find or create recipient identity');
      throw error;
    }
  }

  static async setPassword(id: string, passwordHash: string) {
    try {
      return await prismaWrite.recipientIdentity.update({
        where: { id },
        data: { password_hash: passwordHash, email_verified: true },
      });
    } catch (error) {
      logger.error({ error, id }, 'Failed to set recipient password');
      throw error;
    }
  }
}

export class RecipientLoginFailureRepository {
  static async record(email: string, ipAddress: string, reason: string, recipientId?: string | null) {
    try {
      await prismaWrite.recipientLoginFailure.create({
        data: { email, ip_address: ipAddress, reason, recipient_id: recipientId ?? null },
      });
    } catch (error) {
      logger.error({ error, email }, 'Failed to record recipient login failure');
    }
  }

  /** Count recent failures for either the email or the IP, whichever is higher risk. */
  static async countRecent(email: string, ipAddress: string, sinceMinutes: number): Promise<number> {
    try {
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
      const [byEmail, byIp] = await Promise.all([
        prismaRead.recipientLoginFailure.count({ where: { email, created_at: { gte: since } } }),
        prismaRead.recipientLoginFailure.count({ where: { ip_address: ipAddress, created_at: { gte: since } } }),
      ]);
      return Math.max(byEmail, byIp);
    } catch (error) {
      logger.error({ error, email }, 'Failed to count recent recipient login failures');
      return 0;
    }
  }
}

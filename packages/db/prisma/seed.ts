import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const prisma = new PrismaClient();
const logger = pino();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Clear existing data (for development only)
    logger.info('Clearing existing notifications...');
    await prisma.notification.deleteMany({});
    logger.info('✅ Cleared existing notifications');

    // Create sample notifications
    logger.info('Creating sample notifications...');

    const sampleNotifications = [
      {
        id: 'notif-seed-1',
        tenantId: 'tenant-default',
        recipientId: 'user-1',
        channel: 'email',
        subject: 'Welcome to Notification Service',
        body: 'This is a sample email notification',
        status: 'pending',
        priority: 'normal',
      },
      {
        id: 'notif-seed-2',
        tenantId: 'tenant-default',
        recipientId: 'user-2',
        channel: 'email',
        subject: 'Account Verification Required',
        body: 'Please verify your email address to complete account setup',
        status: 'pending',
        priority: 'high',
      },
      {
        id: 'notif-seed-3',
        tenantId: 'tenant-default',
        recipientId: 'user-3',
        channel: 'email',
        subject: 'Password Reset Request',
        body: 'You requested to reset your password. Click the link below to proceed.',
        status: 'pending',
        priority: 'high',
      },
      {
        id: 'notif-seed-4',
        tenantId: 'tenant-test',
        recipientId: 'test-user-1',
        channel: 'email',
        subject: 'Test Notification',
        body: 'This is a test notification from the seeder',
        status: 'sent',
        priority: 'normal',
        sentAt: new Date(),
        externalId: 'msg-test-123',
      },
    ];

    for (const notification of sampleNotifications) {
      await prisma.notification.create({
        data: notification,
      });
      logger.info(`✅ Created notification: ${notification.id}`);
    }

    logger.info('✅ Database seeding completed successfully');
  } catch (error) {
    logger.error(error, '❌ Error during database seeding');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

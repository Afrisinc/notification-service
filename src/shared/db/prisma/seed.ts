import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { seedAuthTemplates } from './seeds/templates.seed';

const prisma = new PrismaClient();
const logger = pino();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Clear existing data (for development only)
    logger.info('Clearing existing data...');
    try {
      await prisma.notificationLog.deleteMany({});
      await prisma.notification.deleteMany({});
      await prisma.userPreference.deleteMany({});
      await prisma.templateVersion.deleteMany({});
      await prisma.template.deleteMany({});
      await prisma.apiKey.deleteMany({});
      await prisma.tenant.deleteMany({});
      logger.info('✅ Cleared existing data');
    } catch (error) {
      // Tables might not exist yet in fresh database
      logger.info('ℹ️ Database is empty, skipping delete operations');
    }

    // Create test tenants
    logger.info('Creating test tenants...');
    const tenant1 = await prisma.tenant.create({
      data: {
        code: 'afrisinc-auth',
        name: 'Afrisinc Auth',
        accountId: 'acc-001',
        accountType: 'ORGANIZATION',
        status: 'ACTIVE',
      },
    });

    const tenant2 = await prisma.tenant.create({
      data: {
        code: 'afrisinc-internal',
        name: 'Afrisinc Internal',
        accountId: 'acc-002',
        accountType: 'ORGANIZATION',
        status: 'ACTIVE',
      },
    });

    const tenant3 = await prisma.tenant.create({
      data: {
        code: 'afrisinc-core',
        name: 'Afrisinc Core Tenant',
        accountId: 'acc-003',
        accountType: 'INDIVIDUAL',
        status: 'ACTIVE',
      },
    });

    const tenant4 = await prisma.tenant.create({
      data: {
        code: 'afrisinc-test',
        name: 'Afrisinc Test Tenant',
        accountId: 'acc-004',
        accountType: 'ORGANIZATION',
        status: 'ACTIVE',
      },
    });
    logger.info('✅ Created test tenants');

    // Create sample templates
    logger.info('Creating sample templates...');
    await prisma.template.create({
      data: {
        id: 'template-welcome-1',
        tenantId: tenant1.id,
        code: 'WELCOME_EMAIL',
        channel: 'EMAIL',
        subject: 'Welcome to Afrisinc Auth',
        content: 'Welcome to our notification service! This is a test template.',
        language: 'en',
        active: true,
      },
    });

    await prisma.template.create({
      data: {
        id: 'template-verification-1',
        tenantId: tenant1.id,
        code: 'VERIFY_EMAIL',
        channel: 'EMAIL',
        subject: 'Verify Your Email',
        content: 'Please verify your email address by clicking the link below.',
        language: 'en',
        active: true,
      },
    });

    await prisma.template.create({
      data: {
        id: 'template-welcome-3',
        tenantId: tenant3.id,
        code: 'WELCOME_EMAIL',
        channel: 'EMAIL',
        subject: 'Welcome to Afrisinc Core',
        content: 'Welcome to the Afrisinc Core notification service!',
        language: 'en',
        active: true,
      },
    });

    await prisma.template.create({
      data: {
        id: 'template-welcome-4',
        tenantId: tenant4.id,
        code: 'WELCOME_EMAIL',
        channel: 'EMAIL',
        subject: 'Welcome to Afrisinc Test',
        content: 'Welcome to the test environment!',
        language: 'en',
        active: true,
      },
    });
    logger.info('✅ Created sample templates');

    // Seed production AUTH templates
    logger.info('Seeding production AUTH templates...');
    await seedAuthTemplates();

    // Create sample notifications
    logger.info('Creating sample notifications...');

    const sampleNotifications = [
      {
        id: 'notif-seed-1',
        tenantId: tenant1.id,
        channel: 'EMAIL' as const,
        recipient: 'user1@example.com',
        templateCode: 'WELCOME_EMAIL',
        payload: { name: 'User 1' },
        status: 'PENDING' as const,
        priority: 'NORMAL' as const,
      },
      {
        id: 'notif-seed-2',
        tenantId: tenant1.id,
        channel: 'EMAIL' as const,
        recipient: 'user2@example.com',
        templateCode: 'VERIFY_EMAIL',
        payload: { verifyLink: 'https://example.com/verify?token=abc123' },
        status: 'QUEUED' as const,
        priority: 'HIGH' as const,
      },
      {
        id: 'notif-seed-3',
        tenantId: tenant1.id,
        channel: 'EMAIL' as const,
        recipient: 'user3@example.com',
        templateCode: 'WELCOME_EMAIL',
        payload: { name: 'User 3' },
        status: 'SENT' as const,
        priority: 'NORMAL' as const,
        sentAt: new Date(),
      },
      {
        id: 'notif-seed-4',
        tenantId: tenant2.id,
        channel: 'SMS' as const,
        recipient: '+1234567890',
        templateCode: 'WELCOME_EMAIL',
        payload: { message: 'Test SMS' },
        status: 'PENDING' as const,
        priority: 'LOW' as const,
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

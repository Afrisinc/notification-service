import pino from 'pino';
import bcrypt from 'bcryptjs';
import { prismaWrite } from '../config/prisma';
import { seedPlanLimits } from '../../db/prisma/seeds/plans.seed';

const logger = pino();
const prisma = prismaWrite;

async function main() {
  try {
    logger.info('Starting database seeding...');

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // Create sample users
    logger.info('Creating sample users...');
    const users = await Promise.all([
      prisma.user.upsert({
        where: { email: 'john.individual@example.com' },
        update: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1-555-0101',
          location: 'New York, NY',
        },
        create: {
          email: 'john.individual@example.com',
          password_hash: hashedPassword,
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1-555-0101',
          location: 'New York, NY',
          status: 'ACTIVE',
        },
      }),
      prisma.user.upsert({
        where: { email: 'jane.individual@example.com' },
        update: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1-555-0102',
          location: 'San Francisco, CA',
        },
        create: {
          email: 'jane.individual@example.com',
          password_hash: hashedPassword,
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1-555-0102',
          location: 'San Francisco, CA',
          status: 'ACTIVE',
        },
      }),
      prisma.user.upsert({
        where: { email: 'org.owner@example.com' },
        update: {
          firstName: 'Robert',
          lastName: 'Johnson',
          phone: '+1-555-0103',
          location: 'Chicago, IL',
        },
        create: {
          email: 'org.owner@example.com',
          password_hash: hashedPassword,
          firstName: 'Robert',
          lastName: 'Johnson',
          phone: '+1-555-0103',
          location: 'Chicago, IL',
          status: 'ACTIVE',
        },
      }),
      prisma.user.upsert({
        where: { email: 'org.admin@example.com' },
        update: {
          firstName: 'Alice',
          lastName: 'Williams',
          phone: '+1-555-0104',
          location: 'Boston, MA',
        },
        create: {
          email: 'org.admin@example.com',
          password_hash: hashedPassword,
          firstName: 'Alice',
          lastName: 'Williams',
          phone: '+1-555-0104',
          location: 'Boston, MA',
          status: 'ACTIVE',
        },
      }),
      // AfrisInc users
      prisma.user.upsert({
        where: { email: 'amara.okonkwo@afrisinc.com' },
        update: {
          firstName: 'Amara',
          lastName: 'Okonkwo',
          phone: '+234-806-1234567',
          location: 'Lagos, Nigeria',
        },
        create: {
          email: 'amara.okonkwo@afrisinc.com',
          password_hash: hashedPassword,
          firstName: 'Amara',
          lastName: 'Okonkwo',
          phone: '+234-806-1234567',
          location: 'Lagos, Nigeria',
          status: 'ACTIVE',
        },
      }),
      prisma.user.upsert({
        where: { email: 'kwame.mensah@afrisinc.com' },
        update: {
          firstName: 'Kwame',
          lastName: 'Mensah',
          phone: '+233-207-1234567',
          location: 'Accra, Ghana',
        },
        create: {
          email: 'kwame.mensah@afrisinc.com',
          password_hash: hashedPassword,
          firstName: 'Kwame',
          lastName: 'Mensah',
          phone: '+233-207-1234567',
          location: 'Accra, Ghana',
          status: 'ACTIVE',
        },
      }),
    ]);

    logger.info(`Created/updated ${users.length} users`);

    // Create individual accounts
    logger.info('Creating individual accounts...');
    const johnUser = users[0];
    const janeUser = users[1];

    const johnAccount = await prisma.account.create({
      data: {
        type: 'INDIVIDUAL',
        owner_user_id: johnUser.id,
      },
    });

    const janeAccount = await prisma.account.create({
      data: {
        type: 'INDIVIDUAL',
        owner_user_id: janeUser.id,
      },
    });

    logger.info('Created 2 individual accounts');

    // Seed all plans and limits first (seedPlanLimits handles FREE/STARTER/SCALE/ENTERPRISE/PAYG)
    logger.info('Seeding plans and limits...');
    await seedPlanLimits(prisma);

    // Retrieve plans for sample subscriptions
    const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } });
    const starterPlan = await prisma.plan.findUnique({ where: { name: 'STARTER' } });
    const enterprisePlan = await prisma.plan.findUnique({ where: { name: 'ENTERPRISE' } });

    if (!freePlan || !starterPlan || !enterprisePlan) {
      throw new Error('Plans not found after seeding — check seedPlanLimits');
    }

    // Create subscriptions for individual accounts
    logger.info('Creating subscriptions for individual accounts...');
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await Promise.all([
      prisma.subscription.upsert({
        where: { account_id: johnAccount.id },
        update: {},
        create: {
          account_id: johnAccount.id,
          plan_id: freePlan.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: now,
          current_period_end: periodEnd,
          provider: 'manual',
        },
      }),
      prisma.subscription.upsert({
        where: { account_id: janeAccount.id },
        update: {},
        create: {
          account_id: janeAccount.id,
          plan_id: starterPlan.id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: now,
          current_period_end: periodEnd,
          provider: 'manual',
        },
      }),
    ]);

    logger.info('Created subscriptions for individual accounts');

    // Create organizations
    logger.info('Creating sample organizations...');
    const organization = await prisma.organization.upsert({
      where: { id: 'acme-org-id' },
      update: {
        org_email: 'contact@acme.com',
        org_phone: '+1-555-0200',
        location: '123 Business Ave, New York, NY 10001',
      },
      create: {
        id: 'acme-org-id',
        name: 'Acme Corporation',
        legal_name: 'Acme Corporation Inc.',
        country: 'US',
        tax_id: '12-3456789',
        org_email: 'contact@acme.com',
        org_phone: '+1-555-0200',
        location: '123 Business Ave, New York, NY 10001',
      },
    });

    const afrisinc = await prisma.organization.upsert({
      where: { id: 'afrisinc-org-id' },
      update: {
        org_email: 'info@afrisinc.com',
        org_phone: '+234-1-6292050',
        location: '5, Akin Adesanya Street, Victoria Island, Lagos, Nigeria',
      },
      create: {
        id: 'afrisinc-org-id',
        name: 'AfrisInc',
        legal_name: 'African Solutions and Innovation Company Limited',
        country: 'NG',
        tax_id: 'RC1234567',
        org_email: 'info@afrisinc.com',
        org_phone: '+234-1-6292050',
        location: '5, Akin Adesanya Street, Victoria Island, Lagos, Nigeria',
      },
    });

    logger.info('Created 2 organizations (Acme Corporation and AfrisInc)');

    // Create organization account
    logger.info('Creating organization account...');
    const orgOwner = users[2];
    const orgAdmin = users[3];

    const organizationAccount = await prisma.account.create({
      data: {
        type: 'ORGANIZATION',
        owner_user_id: orgOwner.id,
        organization_id: organization.id,
      },
    });

    logger.info('Created organization account');

    // Add organization members
    logger.info('Adding organization members...');
    await Promise.all([
      prisma.organizationMember.upsert({
        where: {
          organization_id_user_id: {
            organization_id: organization.id,
            user_id: orgOwner.id,
          },
        },
        update: {},
        create: {
          organization_id: organization.id,
          user_id: orgOwner.id,
          role: 'OWNER',
        },
      }),
      prisma.organizationMember.upsert({
        where: {
          organization_id_user_id: {
            organization_id: organization.id,
            user_id: orgAdmin.id,
          },
        },
        update: {},
        create: {
          organization_id: organization.id,
          user_id: orgAdmin.id,
          role: 'ADMIN',
        },
      }),
    ]);

    logger.info('Added organization members');

    // Create subscription for organization account
    logger.info('Creating subscription for organization account...');
    await prisma.subscription.upsert({
      where: { account_id: organizationAccount.id },
      update: {},
      create: {
        account_id: organizationAccount.id,
        plan_id: enterprisePlan.id,
        status: 'active',
        billing_cycle: 'yearly',
        current_period_start: now,
        current_period_end: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
        provider: 'manual',
      },
    });

    logger.info('Created subscription for organization account');

    // Create AfrisInc organization account
    logger.info('Creating AfrisInc organization account...');
    const afrisinc_owner = users[4]; // Amara Okonkwo
    const afrisinc_admin = users[5]; // Kwame Mensah

    const afrisincAccount = await prisma.account.create({
      data: {
        type: 'ORGANIZATION',
        owner_user_id: afrisinc_owner.id,
        organization_id: afrisinc.id,
      },
    });

    logger.info('Created AfrisInc organization account');

    // Add AfrisInc organization members
    logger.info('Adding AfrisInc organization members...');
    await Promise.all([
      prisma.organizationMember.upsert({
        where: {
          organization_id_user_id: {
            organization_id: afrisinc.id,
            user_id: afrisinc_owner.id,
          },
        },
        update: {},
        create: {
          organization_id: afrisinc.id,
          user_id: afrisinc_owner.id,
          role: 'OWNER',
        },
      }),
      prisma.organizationMember.upsert({
        where: {
          organization_id_user_id: {
            organization_id: afrisinc.id,
            user_id: afrisinc_admin.id,
          },
        },
        update: {},
        create: {
          organization_id: afrisinc.id,
          user_id: afrisinc_admin.id,
          role: 'ADMIN',
        },
      }),
    ]);

    logger.info('Added AfrisInc organization members');

    // Create subscription for AfrisInc account
    logger.info('Creating subscription for AfrisInc account...');
    await prisma.subscription.upsert({
      where: { account_id: afrisincAccount.id },
      update: {},
      create: {
        account_id: afrisincAccount.id,
        plan_id: enterprisePlan.id,
        status: 'active',
        billing_cycle: 'yearly',
        current_period_start: now,
        current_period_end: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
        provider: 'manual',
      },
    });

    logger.info('Created subscription for AfrisInc account');

    // Seed login events for analytics testing
    logger.info('Creating sample login events...');
    const loginEventDates = [
      new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      new Date(), // today
    ];

    const loginEvents = [];
    for (const user of users) {
      for (let i = 0; i < loginEventDates.length; i++) {
        // Mix of successful and failed logins
        const status = Math.random() > 0.1 ? 'success' : 'failed'; // 90% success rate
        loginEvents.push(
          prisma.loginEvent.create({
            data: {
              user_id: user.id,
              status,
              ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
              createdAt: new Date(loginEventDates[i].getTime() + Math.random() * 24 * 60 * 60 * 1000),
            },
          })
        );
      }
    }

    await Promise.all(loginEvents);
    logger.info(`Created ${loginEvents.length} login events for analytics`);

    // Seed login failures for security testing
    logger.info('Creating sample login failures...');
    const failureReasons = ['Invalid password', 'Account locked', 'MFA failed', 'Expired token'];
    const failureIPs = ['192.168.1.105', '10.0.0.88', '172.16.0.42', '203.0.113.15', '198.51.100.3'];
    const loginFailures = [];

    // Create 47 failed login attempts in the last 24 hours
    for (let i = 0; i < 47; i++) {
      const ipIndex = i % failureIPs.length;
      const reasonIndex = Math.floor(Math.random() * failureReasons.length);
      const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);

      loginFailures.push(
        prisma.loginFailure.create({
          data: {
            email: i % 3 === 0 ? 'attacker@malicious.com' : i % 2 === 0 ? 'user@example.com' : 'user2@example.com',
            ip_address: failureIPs[ipIndex],
            failure_reason: failureReasons[reasonIndex],
            user_id: i % 2 === 0 ? users[0].id : users[1].id,
            createdAt: timestamp,
          },
        })
      );
    }

    await Promise.all(loginFailures);
    logger.info(`Created ${loginFailures.length} login failures for security testing`);

    // Seed tokens for security testing
    logger.info('Creating sample tokens...');

    // Create 128 tokens distributed across all users (reduced from 1284 for connection pool)
    const tokenBatchSize = 20;
    let tokenCount = 0;
    for (let batch = 0; batch < 128; batch += tokenBatchSize) {
      const tokenBatch = [];
      for (let i = batch; i < Math.min(batch + tokenBatchSize, 128); i++) {
        const userIndex = i % users.length;
        const tokenType = ['access', 'refresh', 'api_key'][i % 3];
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        tokenBatch.push(
          prisma.token.create({
            data: {
              user_id: users[userIndex].id,
              token_type: tokenType,
              expires_at: expiresAt,
              issued_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            },
          })
        );
      }
      await Promise.all(tokenBatch);
      tokenCount += tokenBatch.length;
    }

    logger.info(`Created ${tokenCount} tokens for security testing`);

    logger.info('✅ Database seeding completed successfully!');
  } catch (error) {
    logger.error(error, '❌ Error during database seeding');
  } finally {
    await prisma.$disconnect();
  }
}

main();

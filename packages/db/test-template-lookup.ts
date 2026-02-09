import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '7c5681e1-4856-4ee9-8a95-ed6991f5eb82'; // afrisinc-auth
  const code = 'WELCOME_EMAIL';
  const channel = 'EMAIL';
  const language = 'en';

  // Test findFirst
  console.log('Testing findFirst...');
  const template = await prisma.template.findFirst({
    where: {
      tenantId,
      code,
      channel: channel as any,
      language,
      deletedAt: null,
    },
  });

  console.log('Found template:', template);
}

main().catch(console.error).finally(() => prisma.$disconnect());

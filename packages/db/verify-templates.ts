import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.template.findMany({
    select: {
      id: true,
      code: true,
      channel: true,
      language: true,
      active: true,
    },
  });

  console.log('Templates in database:');
  console.table(templates);
}

main().catch(console.error).finally(() => prisma.$disconnect());

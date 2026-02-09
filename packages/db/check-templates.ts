import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants);

  const templates = await prisma.template.findMany();
  console.log('Templates:', templates);
}

main().catch(console.error).finally(() => prisma.$disconnect());

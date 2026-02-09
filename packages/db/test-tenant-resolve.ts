import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Simulate what tenant service does
  const tenantCode = 'afrisinc-auth'; // from header
  
  const tenant = await prisma.tenant.findUnique({
    where: { code: tenantCode },
  });

  if (!tenant) {
    console.log('Tenant not found');
    return;
  }

  console.log('Tenant from DB:', tenant);
  
  const returnedTenant = {
    id: tenant.id,
    name: tenant.name,
    active: tenant.status === 'ACTIVE',
  };
  
  console.log('Returned Tenant object:', returnedTenant);
  console.log('tenant.id:', returnedTenant.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());

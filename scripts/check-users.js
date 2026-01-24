const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      tenant: true
    }
  });

  console.log('Found users:', users.length);
  users.forEach(user => {
    console.log('------------------------------------------------');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Tenant: ${user.tenant?.companyName}`);
    console.log(`Email Verified: ${user.emailVerified}`);
    console.log(`Password Hash (first 10 chars): ${user.passwordHash?.substring(0, 10)}...`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

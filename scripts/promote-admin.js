const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pricepilot_db";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.user.updateMany({
    data: { isSuperAdmin: true }
  });
  console.log(`Promoted ${result.count} users to Super Admin.`);
}

main()
  .catch(err => {
    console.error('Promotion failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

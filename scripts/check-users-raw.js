const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_smlN2EVxh6MF@ep-curly-hall-a1fbuw5r-pooler.ap-southeast-1.aws.neon.tech/pricepilot_db?sslmode=require"
  });

  await client.connect();

  try {
    const res = await client.query('SELECT u.id, u.email, u.role, u."emailVerified", u."passwordHash", u."tenantId", t."companyName" FROM "User" u LEFT JOIN "Tenant" t ON u."tenantId" = t.id');

    console.log('Found users:', res.rows.length);
    res.rows.forEach(user => {
      console.log('------------------------------------------------');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Tenant: ${user.companyName}`);
      console.log(`Email Verified: ${user.emailVerified}`);
      const hash = user.passwordHash || "NULL";
      console.log(`Password Hash (first 10 chars): ${hash.substring(0, 10)}...`);
    });

  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await client.end();
  }
}

main();

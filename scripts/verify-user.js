const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_smlN2EVxh6MF@ep-curly-hall-a1fbuw5r-pooler.ap-southeast-1.aws.neon.tech/pricepilot_db?sslmode=require"
  });

  await client.connect();

  try {
    const email = 'patwary.web@gmail.com';
    const res = await client.query('UPDATE "User" SET "emailVerified" = NOW() WHERE email = $1 RETURNING *', [email]);

    if (res.rows.length > 0) {
      console.log(`Successfully verified email for user: ${res.rows[0].email}`);
      console.log(`New emailVerified value: ${res.rows[0].emailVerified}`);
    } else {
      console.log(`User not found: ${email}`);
    }

  } catch (err) {
    console.error("Update Error:", err);
  } finally {
    await client.end();
  }
}

main();

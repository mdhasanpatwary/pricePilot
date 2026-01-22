const { Client } = require('pg');

async function check() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_smlN2EVxh6MF@ep-curly-hall-a1fbuw5r-pooler.ap-southeast-1.aws.neon.tech/pricepilot_db?sslmode=require"
  });

  await client.connect();
  try {
    const res = await client.query('SELECT count(*) FROM "Product" WHERE "imageUrl" IS NOT NULL');
    console.log('Products with imageUrl:', res.rows[0].count);

    if (res.rows[0].count > 0) {
      const sample = await client.query('SELECT title, "imageUrl" FROM "Product" WHERE "imageUrl" IS NOT NULL LIMIT 1');
      console.log('Sample:', sample.rows[0]);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();

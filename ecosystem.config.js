/**
 * PM2 process definitions for PricePilot.
 *
 * Two processes:
 * - Web: Next.js server
 * - Worker: BullMQ background workers (sync/scraping/notifications)
 *
 * Notes:
 * - Next.js loads `.env` files automatically at runtime.
 * - The worker explicitly loads `.env` via dotenv in `scripts/start-worker.ts`.
 * - Set `REDIS_URL` (and other secrets) in your environment or `.env` on the server.
 */
module.exports = {
  apps: [
    {
      name: "pricepilot-web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Keep web lightweight; scale via instances/cluster only when needed.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      time: true,
    },
    {
      name: "pricepilot-worker",
      script: "npm",
      args: "run worker",
      env: {
        NODE_ENV: "production",
      },
      // Do not run multiple worker processes unless you intentionally want
      // multiple concurrent BullMQ consumers.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "2G",
      time: true,
    },
  ],
};


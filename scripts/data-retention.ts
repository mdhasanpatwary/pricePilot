import { MaintenanceService } from "../lib/services/maintenance";
import { prisma } from "../lib/prisma";

async function run() {
  try {
    await MaintenanceService.runDataRetention();
    process.exit(0);
  } catch (error) {
    console.error("Manual retention run failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { format } from "date-fns";

const execAsync = promisify(exec);

// Configuration
const BACKUP_DIR = path.join(process.cwd(), "backups");
const RETENTION_DAYS = 7;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not defined in environment variables.");
  process.exit(1);
}

async function createBackup() {
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
  const filename = `backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`📦 Starting database backup: ${filename}`);

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Run pg_dump and pipe to gzip
    // Note: Requires pg_dump and gzip to be installed in the environment
    await execAsync(`pg_dump "${DATABASE_URL}" | gzip > "${filepath}"`);

    console.log(`✅ Backup created successfully: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

async function cleanOldBackups() {
  console.log("🧹 Cleaning old backups...");

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith("backup_") || !file.endsWith(".sql.gz")) continue;

      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > retentionMs) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
        deletedCount++;
      }
    }

    console.log(`✨ Cleanup complete. Removed ${deletedCount} old backups.`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    // Don't throw here, backup was successful
  }
}

async function main() {
  try {
    await createBackup();
    await cleanOldBackups();
  } catch (error) {
    process.exit(1);
  }
}

main();

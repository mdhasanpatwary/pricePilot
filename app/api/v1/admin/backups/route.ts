import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), "backups");

/**
 * GET: List all backup files
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json([]);
    }

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith("backup_") && file.endsWith(".sql.gz"))
      .map((file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to list backups:", error);
    return NextResponse.json(
      { error: "Failed to list backups" },
      { status: 500 },
    );
  }
}

/**
 * POST: Trigger a manual backup
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Triggering manual backup via API...");
    // Use the existing npm script
    const { stdout, stderr } = await execAsync("npm run backup");

    if (stderr && !stdout) {
      console.warn("Backup script stderr:", stderr);
    }

    return NextResponse.json({
      success: true,
      message: "Backup process started",
      output: stdout,
    });
  } catch (error) {
    console.error("Backup trigger failed:", error);
    return NextResponse.json(
      { error: "Failed to trigger backup" },
      { status: 500 },
    );
  }
}

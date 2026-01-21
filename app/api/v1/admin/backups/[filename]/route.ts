import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

/**
 * GET: Download a specific backup file
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = params;

  if (
    !filename ||
    !filename.startsWith("backup_") ||
    !filename.endsWith(".sql.gz")
  ) {
    return NextResponse.json(
      { error: "Invalid backup filename" },
      { status: 400 },
    );
  }

  try {
    const filePath = path.join(BACKUP_DIR, filename);

    if (fs.existsSync(filePath)) {
      const file = fs.readFileSync(filePath);

      return new NextResponse(file, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Download backup failed:", error);
    return NextResponse.json(
      { error: "Failed to download backup" },
      { status: 500 },
    );
  }
}

/**
 * DELETE: Remove a specific backup file
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { filename: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = params;

  if (
    !filename ||
    !filename.startsWith("backup_") ||
    !filename.endsWith(".sql.gz")
  ) {
    return NextResponse.json(
      { error: "Invalid backup filename" },
      { status: 400 },
    );
  }

  try {
    const filePath = path.join(BACKUP_DIR, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({
        success: true,
        message: `Backup ${filename} deleted`,
      });
    } else {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Delete backup failed:", error);
    return NextResponse.json(
      { error: "Failed to delete backup" },
      { status: 500 },
    );
  }
}

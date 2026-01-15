import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import path from 'path';
import fs from 'fs/promises';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to download the package.' },
        { status: 401 }
      );
    }

    // Path to the Laravel package zip file
    const filePath = path.join(
      process.cwd(),
      'integrations',
      'pricepilot-laravel-v1.0.0.zip'
    );

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'Package file not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = await fs.readFile(filePath);

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="pricepilot-laravel-v1.0.0.zip"',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download package. Please try again or contact support.' },
      { status: 500 }
    );
  }
}

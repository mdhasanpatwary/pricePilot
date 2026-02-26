import { NextResponse } from "next/server";

/**
 * No-op handler for excluded routes in production.
 * This file replaces debug routes during the build process
 * to ensure sensitive code is completely removed from the bundle.
 */
export async function GET() {
  return new NextResponse(null, { status: 404 });
}

export async function POST() {
  return new NextResponse(null, { status: 404 });
}

export async function PUT() {
  return new NextResponse(null, { status: 404 });
}

export async function PATCH() {
  return new NextResponse(null, { status: 404 });
}

export async function DELETE() {
  return new NextResponse(null, { status: 404 });
}

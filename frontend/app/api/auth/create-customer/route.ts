/**
 * DEPRECATED — customer creation is now handled by the Vapor backend
 * at POST /auth/register. This route exists only to return a clear error
 * if old client code still calls it.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use POST /auth/register on the Vapor API instead." },
    { status: 410 }
  );
}

import { NextRequest, NextResponse } from "next/server";

// Service mode: no OAuth
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/settings?strava=service_mode", req.nextUrl.origin));
}



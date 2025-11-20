import { NextResponse } from "next/server";

// Service mode: no OAuth. Inform the client.
export async function GET() {
  return NextResponse.json({ ok: false, serviceMode: true, message: "Strava OAuth disabled in service mode" }, { status: 200 });
}











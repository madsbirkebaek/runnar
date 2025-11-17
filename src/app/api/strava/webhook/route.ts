import { NextRequest, NextResponse } from "next/server";

// Verification + event receiver. Configure STRAVA_VERIFY_TOKEN in env.
export async function GET(req: NextRequest) {
  const hubMode = req.nextUrl.searchParams.get("hub.mode");
  const hubToken = req.nextUrl.searchParams.get("hub.verify_token");
  const hubChallenge = req.nextUrl.searchParams.get("hub.challenge");

  if (hubMode === "subscribe" && hubToken === process.env.STRAVA_VERIFY_TOKEN && hubChallenge) {
    return NextResponse.json({ "hub.challenge": hubChallenge });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const evt = await req.json();
  // Minimal echo; in production you'd enqueue to process (match activity to planned workout). We'll store via Supabase edge function too.
  return NextResponse.json({ received: true });
}

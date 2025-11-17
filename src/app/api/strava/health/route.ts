import { NextResponse } from "next/server";
import { getServiceAccessToken } from "@/lib/strava";

export async function GET() {
  try {
    const token = await getServiceAccessToken(true);
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, body });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ZPayload = z.object({
  access_token: z.string(),
  workouts: z.array(z.object({
    date: z.string(), // ISO
    name: z.string(),
    description: z.string().optional(),
  })).max(50),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ZPayload.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const { access_token, workouts } = parsed.data;

  // Strava doesn't have a native "planned workouts" API; we create private activities with type=Workout and a description note
  // This is optional and can be toggled by the user. Here we push minimal metadata.
  try {
    const results: any[] = [];
    for (const w of workouts) {
      const res = await fetch("https://www.strava.com/api/v3/activities", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: w.name,
          type: "Workout",
          start_date_local: `${w.date}T07:00:00`,
          elapsed_time: 3600,
          description: w.description || "Planned workout",
          private: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "strava_push_error");
      results.push({ id: json.id, date: w.date });
    }
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

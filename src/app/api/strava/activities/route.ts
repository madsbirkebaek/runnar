import { NextResponse } from "next/server";
import { getServiceAccessToken } from "@/lib/strava";

function startOfISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // 1..7 Mon..Sun
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  try {
    let token: string;
    try {
      token = await getServiceAccessToken();
    } catch (e: any) {
      return NextResponse.json({ error: "service_token_error", message: e?.message || "Missing STRAVA_ACCESS_TOKEN or refresh credentials" }, { status: 503 });
    }
    const since = Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 56) / 1000); // ~8 weeks
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", "1");
    url.searchParams.set("after", String(since));
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    let acts = await res.json();
    if (res.status === 401) {
      token = await getServiceAccessToken(true);
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      acts = await res.json();
      
    }
    if (!res.ok) {
      return NextResponse.json({ error: "strava_error", status: res.status, details: acts?.message || acts }, { status: res.status });
    }

    // Filter runs and aggregate per ISO week and include run details
    const runs = (acts || []).filter((a: any) => a.type === "Run");
    const weeksMap = new Map<string, { total_km: number; count: number; runs: any[] }>();
    for (const a of runs) {
      const d = new Date(a.start_date);
      const weekKey = startOfISOWeek(d).toISOString().slice(0, 10);
      const distKm = (a.distance || 0) / 1000;
      const durMin = (a.moving_time || 0) / 60;
      const paceMinPerKm = distKm > 0 ? durMin / distKm : null;
      const details = {
        id: a.id,
        name: a.name,
        date: a.start_date,
        distance_km: Math.round(distKm * 10) / 10,
        duration_min: Math.round(durMin),
        pace_min_per_km: paceMinPerKm ? Math.round(paceMinPerKm * 100) / 100 : null,
        type: a.workout_type ?? a.sport_type ?? a.type,
      };
      const prev = weeksMap.get(weekKey) || { total_km: 0, count: 0, runs: [] };
      prev.total_km += distKm;
      prev.count += 1;
      prev.runs.push(details);
      weeksMap.set(weekKey, prev);
    }

    const weeks = Array.from(weeksMap.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([weekStart, v], idx) => ({ weekStart, total_km: Math.round(v.total_km), count: v.count, idx: idx + 1, runs: v.runs.sort((a: any, b: any) => (a.date < b.date ? -1 : 1)) }));

    const totalKm = weeks.reduce((s, w) => s + w.total_km, 0);
    const avgKm = weeks.length ? Math.round(totalKm / weeks.length) : 0;
    return NextResponse.json({ weeks, totalKm, avgKm });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}



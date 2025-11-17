import { NextResponse } from "next/server";
import { getServiceAccessToken } from "@/lib/strava";
import { createClient } from "@supabase/supabase-js";
import { computeMatchScore } from "@/lib/matching";
import { ScheduledSession } from "@/lib/schedule";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
    const userId = "00000000-0000-0000-0000-000000000000"; // Default user ID

    // Get active plan and schedule for auto-matching
    let activePlan: any = null;
    let schedule: ScheduledSession[] = [];
    if (supabaseAdmin) {
      const { data: planRows } = await supabaseAdmin
        .from("plans")
        .select("id, data, start_date, end_date")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (planRows && planRows[0]) {
        activePlan = planRows[0];
        if (activePlan.data?.schedule && Array.isArray(activePlan.data.schedule)) {
          schedule = activePlan.data.schedule;
        }
      }
    }

    for (const a of runs) {
      const d = new Date(a.start_date);
      const weekKey = startOfISOWeek(d).toISOString().slice(0, 10);
      const distKm = (a.distance || 0) / 1000;
      const durMin = (a.moving_time || 0) / 60;
      const paceMinPerKm = distKm > 0 ? durMin / distKm : null;
      const activityDate = a.start_date.slice(0, 10); // YYYY-MM-DD

      const details = {
        id: a.id,
        name: a.name,
        date: a.start_date,
        distance_km: Math.round(distKm * 10) / 10,
        duration_min: Math.round(durMin),
        pace_min_per_km: paceMinPerKm ? Math.round(paceMinPerKm * 100) / 100 : null,
        type: a.workout_type ?? a.sport_type ?? a.type,
        average_heartrate: a.average_heartrate || null,
        max_heartrate: a.max_heartrate || null,
        elevation_gain: a.total_elevation_gain || a.elevation_gain || null,
        calories: a.calories || null,
        average_speed_ms: a.average_speed || null,
        max_speed_ms: a.max_speed || null,
      };
      const prev = weeksMap.get(weekKey) || { total_km: 0, count: 0, runs: [] };
      prev.total_km += distKm;
      prev.count += 1;
      prev.runs.push(details);
      weeksMap.set(weekKey, prev);

      // Store activity in database
      if (supabaseAdmin) {
        try {
          const { error: upsertError } = await supabaseAdmin
            .from("activities")
            .upsert(
              {
                id: a.id,
                user_id: userId,
                name: a.name,
                date: activityDate,
                distance_km: Math.round(distKm * 10) / 10,
                duration_min: Math.round(durMin),
                pace_min_per_km: paceMinPerKm ? Math.round(paceMinPerKm * 100) / 100 : null,
                type: String(a.workout_type ?? a.sport_type ?? a.type),
                average_heartrate: a.average_heartrate || null,
                max_heartrate: a.max_heartrate || null,
                elevation_gain: a.total_elevation_gain || a.elevation_gain || null,
                total_elevation_gain: a.total_elevation_gain || a.elevation_gain || null,
                calories: a.calories || null,
                average_speed_ms: a.average_speed || null,
                max_speed_ms: a.max_speed || null,
                strava_data: a,
              },
              { onConflict: "id" }
            );

          if (upsertError) {
            console.error("Error storing activity:", upsertError);
          } else {
            // Auto-match with sessions on the same date
            if (activePlan && schedule.length > 0) {
              const sessionsOnDate = schedule.filter((s) => s.date === activityDate);
              if (sessionsOnDate.length > 0) {
                // Find best match
                let bestMatch: { session: ScheduledSession; score: number } | null = null;
                for (const session of sessionsOnDate) {
                  const score = computeMatchScore(session, {
                    id: a.id,
                    date: activityDate,
                    distance_km: distKm,
                    duration_min: durMin,
                    pace_min_per_km: paceMinPerKm,
                  });
                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { session, score };
                  }
                }

                // If best score >= 70, create link
                if (bestMatch && bestMatch.score >= 70) {
                  try {
                    const { error: linkError } = await supabaseAdmin
                      .from("session_activity_links")
                      .upsert(
                        {
                          plan_id: activePlan.id,
                          session_date: activityDate,
                          session_type: bestMatch.session.type,
                          activity_id: a.id,
                          match_score: bestMatch.score,
                        },
                        { onConflict: "plan_id,session_date,session_type" }
                      );

                    if (linkError) {
                      console.error("Error auto-matching activity:", linkError);
                    }
                  } catch (linkErr) {
                    console.error("Error auto-matching activity:", linkErr);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("Error storing activity:", err);
        }
      }
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



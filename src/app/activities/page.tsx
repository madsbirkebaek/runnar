"use client";

import { useEffect, useState } from "react";
import NavTabs from "@/components/NavTabs";
import { supabase } from "@/lib/supabaseClient";
import ActivityDetailModal from "@/components/ActivityDetailModal";

type Run = {
  id: number;
  name: string;
  date: string; // ISO
  distance_km: number;
  duration_min: number;
  pace_min_per_km: number | null;
  type: string | number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  elevation_gain?: number | null;
  calories?: number | null;
};

type Week = {
  idx: number;
  weekStart: string; // ISO date (Mon)
  total_km: number;
  count: number;
  runs: Run[];
};

function formatPace(p: number | null) {
  if (!p || !isFinite(p)) return "-";
  const mm = Math.floor(p);
  const ss = Math.round((p - mm) * 60);
  const ssp = ss.toString().padStart(2, "0");
  return `${mm}:${ssp} /km`;
}

function isoWeekFromISODate(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  // ISO week: week with Thursday is week 1
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return week;
}


function typeLabel(t: string | number | null) {
  if (t === null || t === undefined) return "Run";
  if (typeof t === "number") {
    // Strava workout_type for runs: 0=default, 1=race, 2=long run, 3=workout
    switch (t) {
      case 1:
        return "Race";
      case 2:
        return "Long run";
      case 3:
        return "Workout";
      default:
        return "Run";
    }
  }
  return t;
}

export default function ActivitiesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activityLinks, setActivityLinks] = useState<Map<number, { id: string; plan_id: string; session_date: string; session_type: string; match_score: number }>>(new Map());
  const [selectedActivity, setSelectedActivity] = useState<Run | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [activitiesRes, linksRes] = await Promise.all([
          fetch("/api/strava/activities"),
          supabase.from("session_activity_links").select("*"),
        ]);

        const j = await activitiesRes.json().catch(() => ({}));
        if (!activitiesRes.ok) throw new Error(`${j?.error || "error"}${j?.details ? `: ${j.details}` : ""} [${activitiesRes.status}]`);
        setWeeks(j.weeks || []);

        if (linksRes.data) {
          const linksMap = new Map();
          for (const link of linksRes.data) {
            linksMap.set(link.activity_id, {
              id: link.id,
              plan_id: link.plan_id,
              session_date: link.session_date,
              session_type: link.session_type,
              match_score: link.match_score,
            });
          }
          setActivityLinks(linksMap);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {loading && <div className="text-sm text-zinc-600 dark:text-zinc-400">Henter aktiviteter…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && (
          <div className="space-y-6">
            {weeks.map((w) => (
              <div key={w.idx} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">Uge {isoWeekFromISODate(w.weekStart)} — start {w.weekStart}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{w.total_km} km • {w.count} løb</div>
                </div>

                <div className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                  {w.runs?.map((r) => {
                    const link = activityLinks.get(r.id);
                    const isLinked = !!link;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedActivity(r)}
                        className={`flex items-center justify-between py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                          isLinked ? "bg-green-50/50 dark:bg-green-950/20" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{r.name || "Run"}</div>
                            {isLinked && <span className="text-xs text-green-600 dark:text-green-400">✓</span>}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{r.date.slice(0, 10)} • {typeLabel(r.type)}</div>
                        </div>
                        <div className="text-right">
                          <div>{r.distance_km} km</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{formatPace(r.pace_min_per_km)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!w.runs?.length && (
                    <div className="py-2 text-xs text-zinc-600 dark:text-zinc-400">Ingen løb registreret</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {selectedActivity && (
          <ActivityDetailModal
            activity={{
              id: selectedActivity.id,
              name: selectedActivity.name,
              date: selectedActivity.date.slice(0, 10),
              distance_km: selectedActivity.distance_km,
              duration_min: selectedActivity.duration_min,
              pace_min_per_km: selectedActivity.pace_min_per_km,
              average_heartrate: selectedActivity.average_heartrate,
              max_heartrate: selectedActivity.max_heartrate,
              elevation_gain: selectedActivity.elevation_gain,
              calories: selectedActivity.calories,
            }}
            link={activityLinks.get(selectedActivity.id) || null}
            onClose={() => {
              setSelectedActivity(null);
              // Reload links
              supabase
                .from("session_activity_links")
                .select("*")
                .then(({ data }) => {
                  if (data) {
                    const linksMap = new Map();
                    for (const link of data) {
                      linksMap.set(link.activity_id, {
                        id: link.id,
                        plan_id: link.plan_id,
                        session_date: link.session_date,
                        session_type: link.session_type,
                        match_score: link.match_score,
                      });
                    }
                    setActivityLinks(linksMap);
                  }
                });
            }}
            onLinkChange={() => {
              // Reload links
              supabase
                .from("session_activity_links")
                .select("*")
                .then(({ data }) => {
                  if (data) {
                    const linksMap = new Map();
                    for (const link of data) {
                      linksMap.set(link.activity_id, {
                        id: link.id,
                        plan_id: link.plan_id,
                        session_date: link.session_date,
                        session_type: link.session_type,
                        match_score: link.match_score,
                      });
                    }
                    setActivityLinks(linksMap);
                  }
                });
            }}
          />
        )}
      </main>
    </div>
  );
}







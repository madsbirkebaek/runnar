"use client";

import { useEffect, useState } from "react";
import NavTabs from "@/components/NavTabs";

type Run = {
  id: number;
  name: string;
  date: string; // ISO
  distance_km: number;
  duration_min: number;
  pace_min_per_km: number | null;
  type: string | number | null;
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/strava/activities")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`${j?.error || "error"}${j?.details ? `: ${j.details}` : ""} [${r.status}]`);
        setWeeks(j.weeks || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
                  {w.runs?.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium">{r.name || "Run"}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{r.date.slice(0, 10)} • {typeLabel(r.type)}</div>
                      </div>
                      <div className="text-right">
                        <div>{r.distance_km} km</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{formatPace(r.pace_min_per_km)}</div>
                      </div>
                    </div>
                  ))}
                  {!w.runs?.length && (
                    <div className="py-2 text-xs text-zinc-600 dark:text-zinc-400">Ingen løb registreret</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}







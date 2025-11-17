"use client";

import { useEffect, useMemo, useState } from "react";
import WeekCalendar from "@/components/WeekCalendar";
import NavTabs from "@/components/NavTabs";
import PlanView, { PlanWeek } from "@/components/PlanView";
import { supabase } from "@/lib/supabaseClient";
import { buildSchedule, ScheduledSession } from "@/lib/schedule";

export default function TodayPage() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState<{ weeks: PlanWeek[]; notes?: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);

  useEffect(() => {
    (async () => {
      // Try Supabase latest plan
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (userId) {
        const [{ data: planRows }, { data: settingsRows }] = await Promise.all([
          supabase.from("plans").select("data,start_date").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
          supabase.from("settings").select("day_map").eq("user_id", userId).limit(1),
        ]);
        if (planRows && planRows[0]) {
          setPlan(planRows[0].data as any);
          const dm = settingsRows?.[0]?.day_map;
          const sched = (planRows[0].data as any).schedule || buildSchedule(planRows[0].data as any, planRows[0].start_date, dm);
          setSchedule(sched);
          return;
        }
      }
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem("rc_plan");
        if (raw) setPlan(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const todaySession = useMemo(() => {
    if (!schedule.length) return null;
    return schedule.find((s) => s.date === selectedDate) || null;
  }, [schedule, selectedDate]);

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <WeekCalendar value={selectedDate} onChange={setSelectedDate} />
        {!todaySession ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Ingen plan fundet. Gå til Plan for at generere.</div>
        ) : (
          <div>
            <div className="mb-2 text-base font-semibold">Dagens træning</div>
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">{iconForType(todaySession.type)}</span>
                <div>
                  <div className="text-sm font-medium capitalize">{todaySession.title || todaySession.type}</div>
                  {todaySession.description && (
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{todaySession.description}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                {typeof todaySession.distance_km === "number" && <span>{todaySession.distance_km} km</span>}
                {typeof todaySession.duration_min === "number" && <span>{todaySession.duration_min} min</span>}
                {todaySession.pace_min_per_km && <span>{todaySession.pace_min_per_km} min/km</span>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function iconForType(t: string) {
  switch (t) {
    case "easy":
      return "🟢";
    case "tempo":
      return "🔵";
    case "interval":
      return "🟣";
    case "long":
      return "🟠";
    case "recovery":
      return "🟡";
    case "hill":
      return "🟤";
    default:
      return "⚪";
  }
}



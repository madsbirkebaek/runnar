"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WeekCalendar from "@/components/WeekCalendar";
import NavTabs from "@/components/NavTabs";
import PlanView, { PlanWeek } from "@/components/PlanView";
import { supabase } from "@/lib/supabaseClient";
import { buildSchedule, ScheduledSession } from "@/lib/schedule";

export default function TodayPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState<{ weeks: PlanWeek[]; notes?: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);

  useEffect(() => {
    (async () => {
      // Use default user ID (no authentication)
      const userId = "00000000-0000-0000-0000-000000000000";
      const [{ data: activePlanRows }, { data: latestPlanRows }, { data: settingsRows }] = await Promise.all([
        supabase
          .from("plans")
          .select("data,start_date")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("plans")
          .select("data,start_date")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("settings").select("day_map").eq("user_id", userId).limit(1),
      ]);
      
      const planRows = activePlanRows && activePlanRows[0] ? activePlanRows : latestPlanRows;
      if (planRows && planRows[0]) {
        setPlan(planRows[0].data as any);
        const dm = settingsRows?.[0]?.day_map;
        const sched = (planRows[0].data as any).schedule || buildSchedule(planRows[0].data as any, planRows[0].start_date, dm);
        setSchedule(sched);
        return;
      }
      
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem("rc_plan");
        if (raw) setPlan(JSON.parse(raw));
      } catch {}
    })();

    const handler = () => {
      // Reload when plan is updated
      window.location.reload();
    };
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
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
            <div 
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => router.push(`/session?date=${selectedDate}`)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{iconForType(todaySession.type)}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{todaySession.title || todaySession.type}</div>
                  {todaySession.description && (
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{todaySession.description}</div>
                  )}
                </div>
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                {typeof todaySession.distance_km === "number" && <span>{todaySession.distance_km} km</span>}
                {typeof todaySession.duration_min === "number" && <span>{todaySession.duration_min} min</span>}
                {todaySession.pace_min_per_km && <span>{todaySession.pace_min_per_km} min/km</span>}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">Klik for at se detaljer og redigere</div>
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



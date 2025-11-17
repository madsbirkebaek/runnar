"use client";

import NavTabs from "@/components/NavTabs";
import GoalForm from "@/components/GoalForm";
import PlansSidebar from "./PlansSidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthCalendar from "@/components/MonthCalendar";
import { buildSchedule, ScheduledSession } from "@/lib/schedule";

export default function PlanPage() {
  const [planData, setPlanData] = useState<any>(null); // full JSON plan
  const [planSummary, setPlanSummary] = useState<{
    title?: string | null;
    description?: string | null;
    distance_label?: string | null;
    distance_km?: number | null;
    race_date?: string | null;
    target_time_sec?: number | null;
    target_pace_sec?: number | null;
  } | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);
  const [dayMap, setDayMap] = useState<Record<string, number> | null>(null);
  const [editing, setEditing] = useState(false);

  function prettyDistance(label?: string | null, km?: number | null) {
    switch (label) {
      case "5k":
        return "5 km";
      case "10k":
        return "10 km";
      case "half":
        return "Halvmaraton";
      case "marathon":
        return "Maraton";
      default:
        return typeof km === "number" ? `${km} km` : label || "";
    }
  }
  function formatSecToTime(sec?: number | null) {
    if (sec == null) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    async function load() {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      const [{ data: planRows }, { data: settingsRows }, { data: allPlans }] = await Promise.all([
        supabase
          .from("plans")
          .select("id,data,start_date,plan_title,plan_description,distance_label,distance_km,race_date,target_time_sec,target_pace_sec,is_active,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("settings").select("day_map").eq("user_id", userId).limit(1),
        supabase
          .from("plans")
          .select("id,plan_title,distance_label,race_date,is_active,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      (window as any).__plansList = allPlans || [];
      if (settingsRows && settingsRows[0]?.day_map) setDayMap(settingsRows[0].day_map);
      if (planRows && planRows[0]) {
        const row: any = planRows[0];
        setPlanData(row.data);
        setPlanSummary({
          title: row.plan_title,
          description: row.plan_description,
          distance_label: row.distance_label,
          distance_km: row.distance_km,
          race_date: row.race_date,
          target_time_sec: row.target_time_sec,
          target_pace_sec: row.target_pace_sec,
        });
        setStartDate(row.start_date);
        const sched = buildSchedule(row.data, row.start_date, settingsRows?.[0]?.day_map || undefined);
        setSchedule(sched);
      }
    }
    load();

    const handler = () => load();
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
  }, []);

  function PlansList() {
    const list: any[] = (typeof window !== "undefined" && (window as any).__plansList) || [];
    if (!list.length) return <div className="text-xs text-zinc-600 dark:text-zinc-400">Ingen planer endnu</div>;
    return (
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className={`rounded-md border px-2 py-1 ${p.is_active ? "border-zinc-900 dark:border-zinc-300" : "border-zinc-300 dark:border-zinc-700"}`}>
            <div className="text-xs font-medium truncate">{p.plan_title || "Plan"}</div>
            <div className="text-[10px] text-zinc-600 dark:text-zinc-400">{p.distance_label || ""} • {p.race_date || new Date(p.created_at).toISOString().slice(0,10)}</div>
          </div>
        ))}
      </div>
    );
  }

  async function moveSession(sess: ScheduledSession, toDate: string) {
    const updated = schedule.filter((s) => !(s.date === sess.date && s.title === sess.title && s.type === sess.type));
    updated.push({ ...sess, date: toDate });
    setSchedule(updated);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return;
    // Save schedule back into latest plan document
    const { data: rows } = await supabase
      .from("plans")
      .select("id,data,start_date")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (rows && rows[0]) {
      const plan = rows[0].data || {};
      plan.schedule = updated; // store under data.schedule
      await supabase.from("plans").update({ data: plan }).eq("id", rows[0].id);
    }
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-8">
        {!planData && !editing && (
          <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            Ingen plan fundet. Opret en ny plan for at komme i gang.
            <div className="pt-3">
              <button onClick={() => setEditing(true)} className="rounded-lg bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-black">Opret plan</button>
            </div>
          </div>
        )}

        {planData && !editing && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <aside className="md:w-56 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div className="mb-2 font-medium">Dine planer</div>
                <PlansList />
              </aside>
              <div className="flex-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold">{planSummary?.title || "Din træningsplan"}</div>
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{planSummary?.description || planData?.notes || "Planen er genereret ud fra dine mål og historik."}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {(planSummary && prettyDistance(planSummary.distance_label, planSummary.distance_km)) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <span aria-hidden>🏁</span>
                        <span>Mål: {prettyDistance(planSummary.distance_label, planSummary.distance_km)}</span>
                      </span>
                    )}
                    {typeof planSummary?.target_time_sec === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <span aria-hidden>⏱️</span>
                        <span>Måltid: {formatSecToTime(planSummary.target_time_sec)}</span>
                      </span>
                    )}
                    {!(typeof planSummary?.target_time_sec === "number") && typeof planSummary?.target_pace_sec === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <span aria-hidden>🚀</span>
                        <span>Målpace: {formatSecToTime(planSummary.target_pace_sec)} /km</span>
                      </span>
                    )}
                    {(startDate || planSummary?.race_date) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <span aria-hidden>📅</span>
                        <span>Periode: {startDate || "?"} → {planSummary?.race_date || "?"}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <button onClick={() => setEditing(true)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Rediger plan</button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-base font-semibold">Kalender (måned) – træk for at flytte pas</div>
              <MonthCalendar schedule={schedule} onMove={moveSession} />
            </div>
          </div>
        </div>
        )}

        {editing && (
          <div className="space-y-4">
            <div className="text-base font-semibold">Rediger/ny plan</div>
            <GoalForm onFinished={() => setEditing(false)} />
            <div>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Fortryd</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



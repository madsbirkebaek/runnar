"use client";

import NavTabs from "@/components/NavTabs";
import GoalForm from "@/components/GoalForm";
import PlansSidebar from "./PlansSidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthCalendar from "@/components/MonthCalendar";
import { buildSchedule, ScheduledSession } from "@/lib/schedule";
import SessionDetailModal from "@/components/SessionDetailModal";

type GoalType = "5k" | "10k" | "half" | "marathon";

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
  const [endDate, setEndDate] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);
  const [dayMap, setDayMap] = useState<Record<string, number> | null>(null);
  const [editing, setEditing] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [sessionLinks, setSessionLinks] = useState<Map<string, { activity_id: number; match_score: number; id: string }>>(new Map());
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

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
      // Use default user ID for now (no authentication)
      const userId = "00000000-0000-0000-0000-000000000000";
      const [{ data: activePlanRows }, { data: latestPlanRows }, { data: settingsRows }, { data: allPlans }] = await Promise.all([
        supabase
          .from("plans")
          .select("id,data,start_date,end_date,plan_title,plan_description,distance_label,distance_km,race_date,target_time_sec,target_pace_sec,is_active,created_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("plans")
          .select("id,data,start_date,end_date,plan_title,plan_description,distance_label,distance_km,race_date,target_time_sec,target_pace_sec,is_active,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("settings").select("day_map").eq("user_id", userId).limit(1),
        supabase
          .from("plans")
          .select("id,plan_title,distance_label,race_date,end_date,is_active,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      (window as any).__plansList = allPlans || [];
      if (settingsRows && settingsRows[0]?.day_map) setDayMap(settingsRows[0].day_map);
      // Use active plan if available, otherwise use latest plan
      const planRows = activePlanRows && activePlanRows[0] ? activePlanRows : latestPlanRows;
      if (planRows && planRows[0]) {
        const row: any = planRows[0];
        setCurrentPlanId(row.id);
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
        setEndDate(row.end_date || row.race_date || null);
        
        // Use saved schedule if it exists (from drag-and-drop edits), otherwise build from weeks
        let sched: ScheduledSession[] = [];
        if (row.data?.schedule && Array.isArray(row.data.schedule)) {
          // Use the saved schedule (includes manual date changes)
          sched = row.data.schedule;
        } else {
          // Build schedule from weeks (initial generation)
          sched = buildSchedule(row.data, row.start_date, settingsRows?.[0]?.day_map || undefined);
        }
        
        // Filter schedule to only show sessions between start and end date
        const filteredSched = sched.filter((s) => {
          if (row.start_date && s.date < row.start_date) return false;
          const end = row.end_date || row.race_date;
          if (end && s.date > end) return false;
          return true;
        });
        setSchedule(filteredSched);
        
        // Load session links
        if (row.id) {
          const { data: links } = await supabase
            .from("session_activity_links")
            .select("*")
            .eq("plan_id", row.id);
          
          if (links) {
            const linksMap = new Map<string, { activity_id: number; match_score: number; id: string }>();
            for (const link of links) {
              const key = `${link.session_date}-${link.session_type}`;
              linksMap.set(key, {
                activity_id: link.activity_id,
                match_score: link.match_score,
                id: link.id,
              });
            }
            setSessionLinks(linksMap);
          }
        }
      }
    }
    load();

    const handler = () => load();
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
  }, []);

  async function reloadLinks() {
    if (!currentPlanId) return;
    const { data: links } = await supabase
      .from("session_activity_links")
      .select("*")
      .eq("plan_id", currentPlanId);
    
    if (links) {
      const linksMap = new Map<string, { activity_id: number; match_score: number; id: string }>();
      for (const link of links) {
        const key = `${link.session_date}-${link.session_type}`;
        linksMap.set(key, {
          activity_id: link.activity_id,
          match_score: link.match_score,
          id: link.id,
        });
      }
      setSessionLinks(linksMap);
    }
  }


  async function moveSession(sess: ScheduledSession, toDate: string) {
    if (!currentPlanId) return;
    
    // More precise matching to find the exact session to move
    const updated = schedule.filter((s) => {
      // Keep sessions that don't match the one being moved
      return !(
        s.date === sess.date &&
        s.type === sess.type &&
        s.title === sess.title &&
        s.distance_km === sess.distance_km &&
        s.duration_min === sess.duration_min &&
        s.pace_min_per_km === sess.pace_min_per_km
      );
    });
    
    // Add the moved session with new date
    updated.push({ ...sess, date: toDate });
    
    // Filter to ensure we only keep sessions within date range
    const filtered = updated.filter((s) => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    });
    
    // Update state immediately for responsive UI
    setSchedule(filtered);
    
    // Use default user ID for now (no authentication)
    const userId = "00000000-0000-0000-0000-000000000000";
    
    // Save schedule back into the active plan
    const { data: row } = await supabase
      .from("plans")
      .select("id,data")
      .eq("id", currentPlanId)
      .eq("user_id", userId)
      .single();
      
    if (row) {
      const plan = row.data || {};
      // Preserve all existing plan data, just update the schedule
      plan.schedule = filtered; // store under data.schedule
      const { error } = await supabase
        .from("plans")
        .update({ data: plan })
        .eq("id", currentPlanId);
        
      if (error) {
        console.error("Error saving moved session:", error);
        alert("Kunne ikke gemme ændring: " + error.message);
        // Reload from database on error to restore correct state
        window.dispatchEvent(new Event("plan:updated"));
      } else {
        // Don't trigger plan:updated here - it would reload and potentially overwrite
        // The state is already updated, so UI should be correct
        // Only trigger if we need other components to refresh
        // window.dispatchEvent(new Event("plan:updated"));
      }
    }
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar med planliste */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Dine planer</h2>
                <button 
                  onClick={() => {
                    setCurrentPlanId(null);
                    setEditing(true);
                  }}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-black"
                >
                  + Ny plan
                </button>
              </div>
              <PlansSidebar />
            </div>
          </aside>

          {/* Hovedindhold */}
          <div className="flex-1 min-w-0">
            {!planData && !editing && (
              <div className="rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Ingen aktiv plan fundet.</p>
                <button 
                  onClick={() => {
                    setCurrentPlanId(null);
                    setEditing(true);
                  }}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
                >
                  Opret ny plan
                </button>
              </div>
            )}

            {planData && !editing && (
              <div className="space-y-6">
                {/* Plan oversigt - større og mere prominent */}
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold mb-2">{planSummary?.title || "Din træningsplan"}</h1>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                        {planSummary?.description || planData?.notes || "Planen er genereret ud fra dine mål og historik."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(planSummary && prettyDistance(planSummary.distance_label, planSummary.distance_km)) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <span aria-hidden>🏁</span>
                            <span>Mål: {prettyDistance(planSummary.distance_label, planSummary.distance_km)}</span>
                          </span>
                        )}
                        {typeof planSummary?.target_time_sec === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <span aria-hidden>⏱️</span>
                            <span>Måltid: {formatSecToTime(planSummary.target_time_sec)}</span>
                          </span>
                        )}
                        {!(typeof planSummary?.target_time_sec === "number") && typeof planSummary?.target_pace_sec === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <span aria-hidden>🚀</span>
                            <span>Målpace: {formatSecToTime(planSummary.target_pace_sec)} /km</span>
                          </span>
                        )}
                        {(startDate || endDate || planSummary?.race_date) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <span aria-hidden>📅</span>
                            <span>Periode: {startDate || "?"} → {endDate || planSummary?.race_date || "?"}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => setEditing(true)} 
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      Rediger plan
                    </button>
                  </div>
                </div>

                {/* Kalender nederst */}
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold mb-1">Kalender</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Træk pas for at flytte dem til andre dage. Klik for at se detaljer.</p>
                  </div>
                  <MonthCalendar
                    schedule={schedule}
                    onMove={moveSession}
                    endDate={endDate || planSummary?.race_date || null}
                    sessionLinks={sessionLinks}
                    onSessionClick={(session) => setSelectedSession(session)}
                  />
                </div>
                
                {selectedSession && currentPlanId && (
                  <SessionDetailModal
                    session={selectedSession}
                    planId={currentPlanId}
                    link={(() => {
                      const key = `${selectedSession.date}-${selectedSession.type}`;
                      const link = sessionLinks.get(key);
                      return link ? { id: link.id, activity_id: link.activity_id, match_score: link.match_score } : null;
                    })()}
                    onClose={() => setSelectedSession(null)}
                    onLinkChange={reloadLinks}
                  />
                )}
              </div>
            )}

            {editing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{currentPlanId ? "Rediger plan" : "Opret ny plan"}</h2>
                  <button 
                    onClick={() => setEditing(false)} 
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    Fortryd
                  </button>
                </div>
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <GoalForm 
                    onFinished={() => {
                      setEditing(false);
                      window.dispatchEvent(new Event("plan:updated"));
                    }}
                    existingPlan={currentPlanId ? {
                      id: currentPlanId,
                      goalType: planSummary?.distance_label as GoalType | undefined,
                      startDate: startDate,
                      endDate: endDate || undefined,
                      selectedDays: dayMap ? Array.from(new Set(Object.values(dayMap))).sort() : undefined,
                      targetType: planSummary?.target_time_sec ? "time" : planSummary?.target_pace_sec ? "pace" : "time",
                      targetTime: planSummary?.target_time_sec ? formatSecToTime(planSummary.target_time_sec) || "" : "",
                      targetPace: planSummary?.target_pace_sec ? formatSecToTime(planSummary.target_pace_sec) || "" : "",
                    } : undefined}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}



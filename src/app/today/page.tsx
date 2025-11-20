"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import NavTabs from "@/components/NavTabs";
import { supabase } from "@/lib/supabaseClient";
import { buildSchedule, ScheduledSession } from "@/lib/schedule";

type WeekProgress = {
  plannedKm: number;
  actualKm: number;
};

function startOfISOWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1..7 Mon..Sun
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(date: Date): { start: string; end: string } {
  const start = startOfISOWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function TodayPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduledSession[]>([]);
  const [weekProgress, setWeekProgress] = useState<WeekProgress | null>(null);
  const [planNotes, setPlanNotes] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login?next=/today");
          return;
        }
        const userId = user.id;
        const [{ data: activePlanRows }, { data: latestPlanRows }, { data: settingsRows }] = await Promise.all([
          supabase
            .from("plans")
            .select("id,data,start_date")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("plans")
            .select("id,data,start_date")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase.from("settings").select("day_map").eq("user_id", userId).limit(1),
        ]);

        const planRows = activePlanRows && activePlanRows[0] ? activePlanRows : latestPlanRows;
        if (planRows && planRows[0]) {
          const row = planRows[0];
          setCurrentPlanId(row.id);
          setPlanNotes((row.data as any)?.notes || null);
          const dm = settingsRows?.[0]?.day_map;
          const endDate = row.end_date || row.race_date || null;
          const sched = (row.data as any).schedule || buildSchedule(row.data as any, row.start_date, dm, endDate);
          setSchedule(sched);

          // Calculate week progress
          const weekDates = getWeekDates(new Date());
          const weekSessions = sched.filter(
            (s: ScheduledSession) => s.date >= weekDates.start && s.date <= weekDates.end
          );
          const plannedKm = weekSessions.reduce((sum: number, s: ScheduledSession) => {
            return sum + (typeof s.distance_km === "number" ? s.distance_km : 0);
          }, 0);

          // Get matched activities for this week
          if (row.id) {
            const { data: links } = await supabase
              .from("session_activity_links")
              .select("activity_id")
              .eq("plan_id", row.id)
              .gte("session_date", weekDates.start)
              .lte("session_date", weekDates.end);

            if (links && links.length > 0) {
              const activityIds = links.map((l) => l.activity_id);
              const { data: activities } = await supabase
                .from("activities")
                .select("distance_km")
                .in("id", activityIds);

              const actualKm = activities
                ? activities.reduce((sum: number, a: any) => sum + (a.distance_km || 0), 0)
                : 0;
              setWeekProgress({ plannedKm, actualKm });
            } else {
              setWeekProgress({ plannedKm, actualKm: 0 });
            }
          } else {
            setWeekProgress({ plannedKm, actualKm: 0 });
          }
        } else {
          setSchedule([]);
          setWeekProgress(null);
        }
      } catch (error) {
        console.error("Error loading plan:", error);
      } finally {
        setLoading(false);
      }
    })();

    const handler = () => {
      window.location.reload();
    };
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
  }, []);

  const todaySession = useMemo(() => {
    if (!schedule.length) return null;
    // First, try to find today's session
    const todaySess = schedule.find((s) => s.date === today);
    if (todaySess) return todaySess;
    // If no session today, find the next upcoming session
    const upcomingSessions = schedule
      .filter((s) => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcomingSessions.length > 0 ? upcomingSessions[0] : null;
  }, [schedule, today]);

  const sessionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      easy: "Easy",
      tempo: "Tempo",
      interval: "Interval",
      long: "Long",
      recovery: "Recovery",
      hill: "Hill",
      race: "Race Day",
      styrke: "Styrke",
      mobilitet: "Mobilitet",
      other: "Andet",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        <NavTabs />
        <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!schedule.length) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        <NavTabs />
        <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
            <div className="text-lg font-semibold mb-2">Ingen plan fundet</div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Opret en træningsplan for at se dagens træningspas.
            </p>
            <button
              onClick={() => router.push("/plan")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Opret plan
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Ugeprogress - vist først hvis der er data */}
        {weekProgress && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-medium mb-1">Ugeprogress</div>
            <div className="text-2xl font-bold">
              {Math.round(weekProgress.actualKm)} km løbet / {Math.round(weekProgress.plannedKm)} km planlagt
            </div>
            {weekProgress.plannedKm > 0 && (
              <div className="mt-2">
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                    style={{
                      width: `${Math.min(100, (weekProgress.actualKm / weekProgress.plannedKm) * 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {Math.round((weekProgress.actualKm / weekProgress.plannedKm) * 100)}% gennemført
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dagens træning / Næste træning */}
        <div>
          <div className="mb-3 text-lg font-semibold">
            {todaySession && todaySession.date === today ? "Dagens træning" : "Næste træning"}
          </div>
          {!todaySession ? (
            <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
              <div className="text-base font-medium mb-2">Ingen planlagt træning</div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Der er ingen træninger i din plan.
              </p>
            </div>
          ) : (
            <div
              className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => router.push(`/plan`)}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl flex-shrink-0">{iconForType(todaySession.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {sessionTypeLabel(todaySession.type)}
                    </span>
                    {todaySession.date !== today && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(todaySession.date + "T00:00:00").toLocaleDateString("da-DK", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    )}
                  </div>
                  {todaySession.title && (
                    <div className="text-lg font-semibold mb-2">{todaySession.title}</div>
                  )}
                  {todaySession.description && (
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 mb-3 whitespace-pre-line">
                      {todaySession.description}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {typeof todaySession.distance_km === "number" && (
                      <span className="inline-flex items-center gap-1">
                        <span>📏</span>
                        <span>{todaySession.distance_km} km</span>
                      </span>
                    )}
                    {typeof todaySession.duration_min === "number" && (
                      <span className="inline-flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{todaySession.duration_min} min</span>
                      </span>
                    )}
                    {todaySession.pace_min_per_km && (
                      <span className="inline-flex items-center gap-1">
                        <span>🚀</span>
                        <span>{todaySession.pace_min_per_km} min/km</span>
                      </span>
                    )}
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {/* CTAs */}
              <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    // Just show info - could expand to show more details
                    alert("Forbered dig til træningen:\n\n" + (todaySession.description || todaySession.title || "Følg din plan"));
                  }}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Start løb
                </button>
                <button
                  onClick={async () => {
                    if (!currentPlanId || !todaySession) return;
                    setLoadingActivities(true);
                    setShowActivityModal(true);
                    try {
                      // Fetch activities for this date from database
                      const { data: activitiesData } = await supabase
                        .from("activities")
                        .select("*")
                        .eq("date", todaySession.date)
                        .order("created_at", { ascending: false });
                      
                      if (activitiesData) {
                        setActivities(activitiesData);
                      } else {
                        setActivities([]);
                      }
                    } catch (error) {
                      console.error("Error fetching activities:", error);
                      setActivities([]);
                    } finally {
                      setLoadingActivities(false);
                    }
                  }}
                  className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
                >
                  Markér som gennemført
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tips/Noter */}
        {(planNotes || todaySession) && (
          <div className="rounded-lg border border-zinc-200 bg-blue-50/50 p-4 dark:border-zinc-800 dark:bg-blue-950/20">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <span>💡</span>
              <span>Tips & Noter</span>
            </div>
            {planNotes && (
              <div className="text-sm text-zinc-700 dark:text-zinc-300 mb-2 whitespace-pre-line">
                {planNotes}
              </div>
            )}
            {todaySession && (
              <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                {todaySession.description && (
                  <>
                    {todaySession.description.toLowerCase().includes("pace") && (
                      <div className="italic">💡 Husk at holde den planlagte pace på denne træning.</div>
                    )}
                    {(todaySession.description.toLowerCase().includes("warm-up") ||
                      todaySession.description.toLowerCase().includes("warmup")) && (
                      <div className="italic">💡 Start med en grundig warm-up før hovedtræningen.</div>
                    )}
                    {(todaySession.description.toLowerCase().includes("z2") ||
                      todaySession.description.toLowerCase().includes("zone 2")) && (
                      <div className="italic">💡 Hold Z2 på warm-up og recovery-sektioner.</div>
                    )}
                  </>
                )}
                {todaySession.type === "interval" && (
                  <div className="italic">
                    💡 Fokuser på at holde en jævn pace gennem hele passet. Tag god tid til recovery mellem intervallerne.
                  </div>
                )}
                {todaySession.type === "tempo" && (
                  <div className="italic">💡 Fokuser på at holde en jævn pace gennem hele passet.</div>
                )}
                {todaySession.type === "long" && (
                  <div className="italic">
                    💡 Tag det roligt og hold en let pace. Det handler om distance, ikke hastighed.
                  </div>
                )}
                {todaySession.type === "recovery" && (
                  <div className="italic">💡 Dette er en recovery-run. Hold det let og afslappet.</div>
                )}
                {todaySession.type === "easy" && (
                  <div className="italic">💡 Hold en let, snakke-tempo pace gennem hele passet.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Activity Selection Modal */}
        {showActivityModal && todaySession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowActivityModal(false)}>
            <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Vælg aktivitet fra Strava</h2>
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                Vælg en aktivitet fra {new Date(todaySession.date + "T00:00:00").toLocaleDateString("da-DK", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })} for at linke til denne session.
              </p>
              {loadingActivities ? (
                <div className="py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">Indlæser aktiviteter...</div>
              ) : activities.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    Ingen aktiviteter fundet for denne dag.
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Aktiviteteter bliver automatisk synkroniseret fra Strava. Du kan linke senere.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {activities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={async () => {
                        if (!currentPlanId || !todaySession) return;
                        try {
                          // Check if link already exists
                          const { data: existing } = await supabase
                            .from("session_activity_links")
                            .select("id")
                            .eq("plan_id", currentPlanId)
                            .eq("session_date", todaySession.date)
                            .eq("session_type", todaySession.type)
                            .single();

                          if (existing) {
                            // Update existing link
                            await supabase
                              .from("session_activity_links")
                              .update({ activity_id: activity.id, match_score: 100 })
                              .eq("id", existing.id);
                          } else {
                            // Create new link
                            await supabase.from("session_activity_links").insert({
                              plan_id: currentPlanId,
                              session_date: todaySession.date,
                              session_type: todaySession.type,
                              activity_id: activity.id,
                              match_score: 100,
                            });
                          }
                          
                          setShowActivityModal(false);
                          // Reload page to update progress
                          window.location.reload();
                        } catch (error) {
                          console.error("Error linking activity:", error);
                          alert("Kunne ikke linke aktivitet. Prøv igen.");
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      <div className="font-medium">{activity.name || "Løb"}</div>
                      <div className="mt-1 flex gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {activity.distance_km && <span>{activity.distance_km.toFixed(1)} km</span>}
                        {activity.duration_min && <span>{Math.round(activity.duration_min)} min</span>}
                        {activity.pace_min_per_km && (
                          <span>
                            {Math.floor(activity.pace_min_per_km)}:
                            {Math.round((activity.pace_min_per_km % 1) * 60)
                              .toString()
                              .padStart(2, "0")}{" "}
                            /km
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
    case "race":
      return "🏁";
    case "styrke":
      return "💪";
    case "mobilitet":
      return "🧘";
    default:
      return "⚪";
  }
}



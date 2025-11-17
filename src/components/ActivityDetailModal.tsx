"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ScheduledSession } from "@/lib/schedule";
import { computeMatchScore } from "@/lib/matching";

interface Activity {
  id: number;
  name: string;
  date: string;
  distance_km: number;
  duration_min: number;
  pace_min_per_km: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  elevation_gain?: number | null;
  calories?: number | null;
  average_speed_ms?: number | null;
  max_speed_ms?: number | null;
}

interface SessionLink {
  id: string;
  plan_id: string;
  session_date: string;
  session_type: string;
  match_score: number;
}

export default function ActivityDetailModal({
  activity,
  link,
  onClose,
  onLinkChange,
}: {
  activity: Activity;
  link: SessionLink | null;
  onClose: () => void;
  onLinkChange: () => void;
}) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedSession, setLinkedSession] = useState<ScheduledSession | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (link) {
      // Load linked session details
      const userId = "00000000-0000-0000-0000-000000000000";
      supabase
        .from("plans")
        .select("id, data")
        .eq("id", link.plan_id)
        .eq("user_id", userId)
        .single()
        .then(({ data: plan }) => {
          if (plan) {
            setPlanId(plan.id);
            const schedule = plan.data?.schedule || [];
            const found = schedule.find(
              (s: ScheduledSession) => s.date === link.session_date && s.type === link.session_type
            );
            if (found) {
              setLinkedSession(found);
            }
          }
        })
        .catch(console.error);
    }
  }, [link]);

  function formatPace(p: number | null) {
    if (!p || !isFinite(p)) return "-";
    const mm = Math.floor(p);
    const ss = Math.round((p - mm) * 60);
    const ssp = ss.toString().padStart(2, "0");
    return `${mm}:${ssp} /km`;
  }

  async function loadSessionsForDate() {
    setLoading(true);
    try {
      const userId = "00000000-0000-0000-0000-000000000000";
      const { data: planRows } = await supabase
        .from("plans")
        .select("id, data, start_date")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (planRows && planRows[0]) {
        const plan = planRows[0];
        setPlanId(plan.id);
        const schedule = plan.data?.schedule || [];
        // Filter sessions on same date or +/- 1 day
        const activityDate = new Date(activity.date);
        const candidates = schedule.filter((s: ScheduledSession) => {
          const sessionDate = new Date(s.date);
          const diffDays = Math.abs((sessionDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 1;
        });

        // Calculate match scores and sort
        const withScores = candidates.map((s: ScheduledSession) => ({
          ...s,
          matchScore: computeMatchScore(s, activity),
        }));

        withScores.sort((a, b) => b.matchScore - a.matchScore);
        setSessions(withScores);
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkSession(session: ScheduledSession) {
    if (!planId) return;

    const matchScore = computeMatchScore(session, activity);
    const res = await fetch("/api/session-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        sessionDate: session.date,
        sessionType: session.type,
        activityId: activity.id,
        matchScore,
      }),
    });

    if (res.ok) {
      onLinkChange();
      onClose();
    } else {
      alert("Kunne ikke linke session");
    }
  }

  async function handleUnlink() {
    if (!link) return;
    const res = await fetch(`/api/session-links?linkId=${link.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      onLinkChange();
      onClose();
    } else {
      alert("Kunne ikke fjerne link");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aktivitet detaljer</h2>
          <button
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Luk
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{activity.name}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{activity.date}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Distance:</span> {activity.distance_km} km
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Pace:</span> {formatPace(activity.pace_min_per_km)}
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Tid:</span>{" "}
                {Math.floor(activity.duration_min / 60) > 0
                  ? `${Math.floor(activity.duration_min / 60)}:${String(Math.floor(activity.duration_min % 60)).padStart(2, "0")}:${String(Math.round((activity.duration_min % 1) * 60)).padStart(2, "0")}`
                  : `${Math.floor(activity.duration_min)}:${String(Math.round((activity.duration_min % 1) * 60)).padStart(2, "0")}`}
              </div>
              {activity.average_heartrate && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Gns. puls:</span> {Math.round(activity.average_heartrate)} bpm
                </div>
              )}
              {activity.max_heartrate && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Max puls:</span> {Math.round(activity.max_heartrate)} bpm
                </div>
              )}
              {activity.elevation_gain && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Højde:</span> {Math.round(activity.elevation_gain)} m
                </div>
              )}
              {activity.calories && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Kalorier:</span> {activity.calories}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="mb-2 text-sm font-medium">Match til planlagt træningspas</h3>
            {link && linkedSession ? (
              <div className="space-y-2">
                <div className="rounded border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">✓ Matchet</div>
                  <div className="mt-1 text-xs text-green-700 dark:text-green-300">
                    Matchet til: {linkedSession.title || linkedSession.type} ({linkedSession.date})
                  </div>
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                    Match: {link.match_score.toFixed(0)}%
                  </div>
                </div>
                <button
                  onClick={handleUnlink}
                  className="w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50"
                >
                  Fjern match
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Ikke matchet</div>
                </div>
                <button
                  onClick={loadSessionsForDate}
                  className="w-full rounded border border-zinc-300 bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                  Find match
                </button>
              </div>
            )}
          </div>

          {sessions.length > 0 && !link && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium">Vælg træningspas</h3>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {sessions.map((session) => {
                  const score = computeMatchScore(session, activity);
                  return (
                    <button
                      key={`${session.date}-${session.type}`}
                      onClick={() => handleLinkSession(session)}
                      className="w-full rounded border border-zinc-200 bg-white p-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <div className="font-medium">{session.title || session.type}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {session.date}
                        {session.distance_km && ` • ${session.distance_km} km`}
                        {session.pace_min_per_km && ` • ${session.pace_min_per_km}`}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Match: {score.toFixed(0)}%</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">Henter sessions...</div>
          )}
        </div>
      </div>
    </div>
  );
}


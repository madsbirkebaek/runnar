"use client";

import { useEffect, useState } from "react";
import { ScheduledSession } from "@/lib/schedule";
import { computeMatchScore } from "@/lib/matching";

interface Activity {
  id: number;
  name: string;
  date: string;
  distance_km: number;
  duration_min: number;
  pace_min_per_km: number | null;
}

interface SessionLink {
  id: string;
  activity_id: number;
  match_score: number;
}

export default function SessionDetailModal({
  session,
  planId,
  link,
  onClose,
  onLinkChange,
}: {
  session: ScheduledSession;
  planId: string;
  link: SessionLink | null;
  onClose: () => void;
  onLinkChange: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedActivity, setLinkedActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (link) {
      // Load linked activity details
      fetch(`/api/strava/activities`)
        .then((r) => r.json())
        .then((data) => {
          const allRuns = data.weeks?.flatMap((w: any) => w.runs || []) || [];
          const found = allRuns.find((r: any) => r.id === link.activity_id);
          if (found) {
            setLinkedActivity({
              id: found.id,
              name: found.name,
              date: found.date.slice(0, 10),
              distance_km: found.distance_km,
              duration_min: found.duration_min,
              pace_min_per_km: found.pace_min_per_km,
            });
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

  async function loadActivitiesForDate() {
    setLoading(true);
    try {
      const res = await fetch("/api/strava/activities");
      const data = await res.json();
      const allRuns = data.weeks?.flatMap((w: any) => w.runs || []) || [];
      // Filter activities on same date or +/- 1 day
      const sessionDate = new Date(session.date);
      const candidates = allRuns.filter((r: any) => {
        const runDate = new Date(r.date);
        const diffDays = Math.abs((runDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 1;
      });

      // Calculate match scores and sort
      const withScores = candidates.map((a: any) => ({
        ...a,
        matchScore: computeMatchScore(session, {
          id: a.id,
          date: a.date.slice(0, 10),
          distance_km: a.distance_km,
          duration_min: a.duration_min,
          pace_min_per_km: a.pace_min_per_km,
        }),
      }));

      withScores.sort((a, b) => b.matchScore - a.matchScore);
      setActivities(withScores);
    } catch (err) {
      console.error("Error loading activities:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkActivity(activityId: number) {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;

    const matchScore = computeMatchScore(session, activity);
    const res = await fetch("/api/session-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        sessionDate: session.date,
        sessionType: session.type,
        activityId,
        matchScore,
      }),
    });

    if (res.ok) {
      onLinkChange();
      onClose();
    } else {
      alert("Kunne ikke linke aktivitet");
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
          <h2 className="text-lg font-semibold">Træningspas detaljer</h2>
          <button
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Luk
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{session.title || session.type}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{session.date}</div>
            {session.description && (
              <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{session.description}</div>
            )}
            <div className="mt-2 text-sm">
              {session.distance_km && <span>{session.distance_km} km</span>}
              {session.pace_min_per_km && (
                <span className="ml-2">Pace: {session.pace_min_per_km}</span>
              )}
              {session.duration_min && <span className="ml-2">{session.duration_min} min</span>}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="mb-2 text-sm font-medium">Status</h3>
            {link && linkedActivity ? (
              <div className="space-y-2">
                <div className="rounded border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">✓ Gennemført</div>
                  <div className="mt-1 text-xs text-green-700 dark:text-green-300">
                    Matchet til aktivitet: {linkedActivity.name}
                  </div>
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                    {linkedActivity.distance_km} km • {formatPace(linkedActivity.pace_min_per_km)} • Match: {link.match_score.toFixed(0)}%
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
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Ikke gennemført</div>
                </div>
                <button
                  onClick={loadActivitiesForDate}
                  className="w-full rounded border border-zinc-300 bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                  Kobl aktivitet
                </button>
              </div>
            )}
          </div>

          {activities.length > 0 && !link && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 className="mb-2 text-sm font-medium">Vælg aktivitet</h3>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {activities.map((activity) => {
                  const score = computeMatchScore(session, activity);
                  return (
                    <button
                      key={activity.id}
                      onClick={() => handleLinkActivity(activity.id)}
                      className="w-full rounded border border-zinc-200 bg-white p-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <div className="font-medium">{activity.name}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {activity.date} • {activity.distance_km} km • {formatPace(activity.pace_min_per_km)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Match: {score.toFixed(0)}%</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">Henter aktiviteter...</div>
          )}
        </div>
      </div>
    </div>
  );
}


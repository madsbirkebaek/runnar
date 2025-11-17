"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ScheduledSession } from "@/lib/schedule";
import NavTabs from "@/components/NavTabs";

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

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    easy: "Rolig løb",
    tempo: "Tempo",
    interval: "Intervaller",
    long: "Langtur",
    recovery: "Restitution",
    hill: "Bakkeløb",
  };
  return labels[type] || type;
}

export default function SessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date");
  const [session, setSession] = useState<ScheduledSession | null>(null);
  const [newDate, setNewDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      router.push("/plan");
      return;
    }

    async function loadSession() {
      const userId = "00000000-0000-0000-0000-000000000000";
      // Get active plan
      const { data: planRows } = await supabase
        .from("plans")
        .select("id, data, start_date")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!planRows || !planRows[0]) {
        setLoading(false);
        return;
      }

      setPlanId(planRows[0].id);
      const plan = planRows[0].data || {};
      const schedule = plan.schedule || [];

      // Find session(s) for this date - if multiple, use the first one
      const found = schedule.find((s: ScheduledSession) => s.date === date);
      if (found) {
        setSession(found);
        setNewDate(found.date);
      }
      setLoading(false);
    }

    loadSession();
  }, [date, router]);

  async function handleUpdateDate() {
    if (!session || !planId || !newDate) return;
    if (newDate === session.date) return;

    setSaving(true);
    const userId = "00000000-0000-0000-0000-000000000000";

    // Get current plan
    const { data: planRow } = await supabase
      .from("plans")
      .select("id, data")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();

    if (!planRow) {
      setSaving(false);
      alert("Kunne ikke finde plan");
      return;
    }

    const plan = planRow.data || {};
    const schedule: ScheduledSession[] = plan.schedule || [];

    // Update session date - match by date, type, and title to uniquely identify the session
    const updatedSchedule = schedule.map((s: ScheduledSession) => {
      if (
        s.date === session.date &&
        s.type === session.type &&
        s.title === session.title &&
        s.distance_km === session.distance_km &&
        s.duration_min === session.duration_min
      ) {
        return { ...s, date: newDate };
      }
      return s;
    });

    plan.schedule = updatedSchedule;

    // Save updated plan
    const { error } = await supabase
      .from("plans")
      .update({ data: plan })
      .eq("id", planId);

    if (error) {
      alert("Kunne ikke opdatere dato: " + error.message);
      setSaving(false);
      return;
    }

    // Update local state and redirect
    setSession({ ...session, date: newDate });
    window.dispatchEvent(new Event("plan:updated"));
    router.push(`/session?date=${newDate}`);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        <NavTabs />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="text-center">Indlæser...</div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
        <NavTabs />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Ingen træning fundet for denne dato.</p>
            <button
              onClick={() => router.push("/plan")}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
            >
              Tilbage til plan
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
        <div>
          <button
            onClick={() => router.push("/plan")}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4"
          >
            ← Tilbage til plan
          </button>
        </div>

        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{iconForType(session.type)}</span>
            <div>
              <h1 className="text-2xl font-bold">{session.title || getTypeLabel(session.type)}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">{getTypeLabel(session.type)}</p>
            </div>
          </div>

          {session.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold mb-2">Formål</h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{session.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {typeof session.distance_km === "number" && (
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Længde</div>
                <div className="text-xl font-semibold">{session.distance_km} km</div>
              </div>
            )}
            {typeof session.duration_min === "number" && (
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Varighed</div>
                <div className="text-xl font-semibold">{session.duration_min} min</div>
              </div>
            )}
            {session.pace_min_per_km && (
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Pace</div>
                <div className="text-xl font-semibold">{session.pace_min_per_km} min/km</div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h2 className="text-sm font-semibold mb-3">Ændre dato</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                onClick={handleUpdateDate}
                disabled={saving || newDate === session.date}
                className="rounded-lg bg-zinc-900 px-4 py-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-black"
              >
                {saving ? "Gemmer..." : "Opdater dato"}
              </button>
            </div>
            {newDate !== session.date && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Træningen flyttes fra {new Date(session.date).toLocaleDateString("da-DK")} til {new Date(newDate).toLocaleDateString("da-DK")}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


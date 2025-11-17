"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthCalendar from "@/components/MonthCalendar";
import { buildSchedule, type ScheduledSession } from "@/lib/schedule";
import SessionInfoModal from "@/components/SessionInfoModal";

type GoalType = "5k" | "10k" | "half" | "marathon";

const weekdays = [
  { label: "Mandag", value: 0 },
  { label: "Tirsdag", value: 1 },
  { label: "Onsdag", value: 2 },
  { label: "Torsdag", value: 3 },
  { label: "Fredag", value: 4 },
  { label: "Lørdag", value: 5 },
  { label: "Søndag", value: 6 },
];

type GoalFormProps = {
  onFinished?: () => void;
  existingPlan?: {
    id?: string;
    goalType?: GoalType;
    startDate?: string;
    endDate?: string;
    selectedDays?: number[];
    targetType?: "time" | "pace";
    targetTime?: string;
    targetPace?: string;
  };
};

export default function GoalForm({ onFinished, existingPlan }: GoalFormProps) {
  const parseTimeToString = (sec?: number | null) => {
    if (sec == null) return "";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const [planId, setPlanId] = useState<string | undefined>(existingPlan?.id);
  const [goalType, setGoalType] = useState<GoalType>(existingPlan?.goalType || "5k");
  const [startDate, setStartDate] = useState<string>(existingPlan?.startDate || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(existingPlan?.endDate || "");
  const [selectedDays, setSelectedDays] = useState<number[]>(existingPlan?.selectedDays || [0, 1, 3, 5]);
  const [targetType, setTargetType] = useState<"time" | "pace">(existingPlan?.targetType || "time");
  const [targetTime, setTargetTime] = useState<string>(existingPlan?.targetTime || "");
  const [targetPace, setTargetPace] = useState<string>(existingPlan?.targetPace || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<any | null>(null);
  const [previewSchedule, setPreviewSchedule] = useState<ScheduledSession[] | null>(null);
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

  function toggleDay(dayValue: number) {
    setSelectedDays((prev) => (prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue].sort()));
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (selectedDays.length === 0) {
      setErrorMsg("Vælg mindst én dag at løbe på");
      return;
    }
    if (targetType === "time" && !targetTime) {
      setErrorMsg("Indtast måltid");
      return;
    }
    if (targetType === "pace" && !targetPace) {
      setErrorMsg("Indtast gennemsnitlig pace");
      return;
    }
    if (endDate && startDate && endDate < startDate) {
      setErrorMsg("Slutdato skal være efter startdato");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setPreviewPlan(null);
    setPreviewSchedule(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalType,
          startDate,
          endDate,
          selectedDays,
          targetType,
          targetTime,
          targetPace,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke generere plan");

      let generated: any = null;
      if (data.weeks) {
        generated = { weeks: data.weeks, notes: data.notes, meta: { plan_title: data.title || "Træningsplan", plan_description: data.description || "" } };
      } else if (typeof data.plan === "string") {
        try {
          let raw = data.plan.trim();
          // Strip Markdown code fences if present
          if (raw.startsWith("```")) {
            raw = raw.slice(3).trim(); // remove opening ```
            // optional language tag (e.g., json)
            const nl = raw.indexOf("\n");
            if (nl !== -1) raw = raw.slice(nl + 1);
            // remove trailing fence
            const fenceEnd = raw.lastIndexOf("```");
            if (fenceEnd !== -1) raw = raw.slice(0, fenceEnd);
          }
          const parsed = JSON.parse(raw);
          if (parsed?.weeks) {
            generated = { weeks: parsed.weeks, notes: parsed.notes, meta: { plan_title: parsed.title || "Træningsplan", plan_description: parsed.description || "" } };
          }
        } catch {}
      }

      if (generated) {
        const fullPlan = generated;
        setPreviewPlan(fullPlan);
        // Build preview schedule using selected days
        const dayMap: Record<string, number> = {};
        // Distribute session types across selected days
        const sessionTypes = ["easy", "tempo", "interval", "long"];
        selectedDays.forEach((day, idx) => {
          const type = sessionTypes[idx % sessionTypes.length] || "easy";
          dayMap[type] = day;
        });
        // Ensure long runs are on weekends if possible
        if (selectedDays.includes(5) || selectedDays.includes(6)) {
          dayMap["long"] = selectedDays.includes(5) ? 5 : 6;
        }
        const start = startDate || new Date().toISOString().slice(0, 10);
        const sched = buildSchedule(fullPlan as any, start, dayMap, endDate || null);
        // Filter schedule to only show sessions between start and end date
        const filteredSched = sched.filter((s) => {
          if (startDate && s.date < startDate) return false;
          if (endDate && s.date > endDate) return false;
          return true;
        });
        setPreviewSchedule(filteredSched);
      } else {
        setErrorMsg("Kunne ikke læse plan fra svar. Prøv igen.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Noget gik galt");
    } finally {
      setLoading(false);
    }
  }

  async function savePreview() {
    if (!previewPlan) return;
    setSaving(true);
    // Use a default user ID for now (no authentication)
    const userId = "00000000-0000-0000-0000-000000000000";
    // Compose JSON with goal metadata + schedule
    const distanceKmMap: Record<GoalType, number | null> = { "5k": 5, "10k": 10, half: 21.097, marathon: 42.195 } as const;
    const dataToSave: any = {
      ...previewPlan,
      goal: {
        ...(previewPlan.goal || {}),
        distance_km: distanceKmMap[goalType] ?? null,
        distance_label: goalType,
        units: "metric",
        target_time: targetType === "time" && targetTime ? targetTime : undefined,
        target_pace: targetType === "pace" && targetPace ? targetPace : undefined,
      },
      schedule: previewSchedule || undefined,
    };
    const parseTimeToSec = (val?: string) => {
      if (!val) return null;
      const parts = val.split(":").map((p) => parseInt(p, 10));
      if (parts.some((n) => Number.isNaN(n))) return null;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return null;
    };
    const target_time_sec = dataToSave.goal?.target_time ? parseTimeToSec(dataToSave.goal.target_time) : null;
    const target_pace_sec = dataToSave.goal?.target_pace ? parseTimeToSec(dataToSave.goal.target_pace) : null;

    // Save day_map to settings
    const dayMap: Record<string, number> = {};
    const sessionTypes = ["easy", "tempo", "interval", "long"];
    selectedDays.forEach((day, idx) => {
      const type = sessionTypes[idx % sessionTypes.length] || "easy";
      dayMap[type] = day;
    });
    if (selectedDays.includes(5) || selectedDays.includes(6)) {
      dayMap["long"] = selectedDays.includes(5) ? 5 : 6;
    }
    await supabase.from("settings").upsert({ user_id: userId, day_map: dayMap });

    // If updating existing plan, use update endpoint, otherwise create new
    const url = planId ? "/api/plans/update" : "/api/plans/save";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        start_date: startDate || new Date().toISOString().slice(0, 10),
        end_date: endDate || null,
        plan_title: previewPlan.meta.plan_title,
        plan_description: previewPlan.meta.plan_description,
        distance_label: goalType,
        distance_km: distanceKmMap[goalType] ?? null,
        race_date: endDate || null,
        target_time_sec,
        target_pace_sec,
        data: dataToSave,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaving(false);
      setErrorMsg(j?.error || "Kunne ikke gemme plan. Prøv igen.");
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("plan:updated"));
    }
    setSaving(false);
    onFinished?.();
  }

  return (
    <form onSubmit={createPlan} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Mål</span>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="5k">5 km</option>
            <option value="10k">10 km</option>
            <option value="half">Halvmaraton</option>
            <option value="marathon">Maraton</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Startdato for plan</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Slutdato for plan</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="text-sm font-medium mb-2 block">Hvilke dage skal du løbe?</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekdays.map((day) => (
              <label
                key={day.value}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedDays.includes(day.value)
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                    : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{day.label}</span>
              </label>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Måltype</span>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "time" | "pace")}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="time">Tid</option>
            <option value="pace">Gns. pace</option>
          </select>
        </label>
        {targetType === "time" && (
          <label className="block">
            <span className="text-sm font-medium">Måltid (hh:mm:ss)</span>
            <input
              type="text"
              placeholder="00:25:00"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
        {targetType === "pace" && (
          <label className="block">
            <span className="text-sm font-medium">Gennemsnitlig pace (mm:ss pr. km)</span>
            <input
              type="text"
              placeholder="05:00"
              value={targetPace}
              onChange={(e) => setTargetPace(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
      </div>
      {errorMsg && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 p-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-black sm:w-auto"
        >
          {loading ? "Genererer plan..." : previewPlan ? "Regenerer plan" : "Generer plan"}
        </button>
        {previewPlan && (
          <button
            type="button"
            disabled={saving}
            onClick={savePreview}
            className="w-full rounded-lg bg-zinc-900 p-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-black sm:w-auto"
          >
            {saving ? "Gemmer..." : "Gem og gå til planoversigt"}
          </button>
        )}
      </div>

      {previewPlan && (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-base font-semibold">Din genererede plan</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            {previewPlan.meta?.plan_description || "Planen er genereret og klar til brug."}
          </div>
          <div className="text-sm font-medium mb-2">Kalenderoversigt</div>
          <MonthCalendar 
            schedule={previewSchedule || []} 
            onMove={() => {}} 
            onSessionClick={(session) => setSelectedSession(session)}
          />
          <div className="pt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Efter du har gemt planen, kan du se den fulde oversigt på planoversigten.
          </div>
        </div>
      )}

      {selectedSession && (
        <SessionInfoModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </form>
  );
}



"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MonthCalendar from "@/components/MonthCalendar";
import { buildSchedule, type ScheduledSession } from "@/lib/schedule";

type GoalType = "5k" | "10k" | "half" | "marathon" | "custom";

export default function GoalForm({ onFinished }: { onFinished?: () => void }) {
  const [goalType, setGoalType] = useState<GoalType>("5k");
  const [targetDate, setTargetDate] = useState("");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [targetType, setTargetType] = useState<"time" | "pace">("time");
  const [targetTime, setTargetTime] = useState("");
  const [targetPace, setTargetPace] = useState("");
  const [weeklyDays, setWeeklyDays] = useState(4);
  const [weeklyTimeMin, setWeeklyTimeMin] = useState<number | "">(180);
  const [historyAvgKm, setHistoryAvgKm] = useState<number | "">(0);
  const [historyWeeks, setHistoryWeeks] = useState<number | "">(6);
  const [pr5k, setPr5k] = useState("");
  const [pr10k, setPr10k] = useState("");
  const [prHalf, setPrHalf] = useState("");
  const [prMarathon, setPrMarathon] = useState("");
  const [injuries, setInjuries] = useState("");
  const [preferences, setPreferences] = useState("");
  const [units, setUnits] = useState<"metric">("metric");
  const [useData, setUseData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<any | null>(null);
  const [previewSchedule, setPreviewSchedule] = useState<ScheduledSession[] | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rc_onboarding");
      if (raw) {
        const v = JSON.parse(raw);
        if (v.distance) setGoalType(v.distance);
        if (v.targetType) setTargetType(v.targetType);
        if (v.targetTime) setTargetTime(v.targetTime);
        if (v.targetPace) setTargetPace(v.targetPace);
        if (v.weeklyDays) setWeeklyDays(v.weeklyDays);
        if (v.weeklyTimeMin) setWeeklyTimeMin(v.weeklyTimeMin);
        if (v.prs) {
          setPr5k(v.prs.pr5k || "");
          setPr10k(v.prs.pr10k || "");
          setPrHalf(v.prs.prHalf || "");
          setPrMarathon(v.prs.prMarathon || "");
        }
        if (v.injuries) setInjuries(v.injuries);
        if (v.preferences) setPreferences(v.preferences);
      }
    } catch {}
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
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
          targetDate,
          startDate,
          targetType,
          targetTime,
          targetPace,
          weeklyDays,
          weeklyTimeMin,
          historyAvgKm,
          historyWeeks,
          prs: { pr5k, pr10k, prHalf, prMarathon },
          injuries,
          preferences,
          units,
          useData,
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
        // Build preview schedule using user day_map if available
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        let dayMapLocal: any = null;
        if (userId) {
          const { data: settingsRows } = await supabase.from("settings").select("day_map").eq("user_id", userId).limit(1);
          dayMapLocal = settingsRows && settingsRows[0]?.day_map ? settingsRows[0].day_map : null;
        }
        const start = (startDate || new Date().toISOString().slice(0, 10));
        const sched = buildSchedule(fullPlan as any, start, dayMapLocal || undefined);
        setPreviewSchedule(sched);
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
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      setSaving(false);
      window.location.href = `/login?next=/plan`;
      return;
    }
    // Compose JSON with goal metadata + schedule
    const distanceKmMap: Record<GoalType, number | null> = { "5k": 5, "10k": 10, half: 21.097, marathon: 42.195, custom: null } as const;
    const dataToSave: any = {
      ...previewPlan,
      goal: {
        ...(previewPlan.goal || {}),
        race_date: targetDate || null,
        distance_km: distanceKmMap[goalType] ?? null,
        distance_label: goalType,
        units: "metric",
        target_pace: targetType === "pace" && targetPace ? targetPace : undefined,
        target_time: targetType === "time" && targetTime ? targetTime : undefined,
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

    const res = await fetch("/api/plans/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: startDate || new Date().toISOString().slice(0, 10),
        plan_title: previewPlan.meta.plan_title,
        plan_description: previewPlan.meta.plan_description,
        distance_label: goalType,
        distance_km: distanceKmMap[goalType] ?? null,
        race_date: targetDate || null,
        target_time_sec,
        target_pace_sec,
        data: dataToSave,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaving(false);
      setErrorMsg(j?.error || "Kunne ikke gemme plan. Prøv igen.");
      if (res.status === 401) window.location.href = `/login?next=/plan`;
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("plan:updated"));
    }
    setSaving(false);
    onFinished?.();
  }

  return (
    <form onSubmit={createPlan} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm">Mål</span>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="5k">5 km</option>
            <option value="10k">10 km</option>
            <option value="half">Halvmaraton</option>
            <option value="marathon">Maraton</option>
            <option value="custom">Tilpasset</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm">Måldato</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Startdato for plan</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Måltype</span>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "time" | "pace")}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="time">Tid</option>
            <option value="pace">Gns. pace</option>
          </select>
        </label>
        {targetType === "time" ? (
          <label className="block">
            <span className="text-sm">Måltid (hh:mm:ss)</span>
            <input
              type="text"
              placeholder="00:25:00"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-sm">Gns. pace (mm:ss pr. km)</span>
            <input
              type="text"
              placeholder="05:00"
              value={targetPace}
              onChange={(e) => setTargetPace(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm">Dage pr. uge</span>
          <input
            type="number"
            min={2}
            max={7}
            value={weeklyDays}
            onChange={(e) => setWeeklyDays(parseInt(e.target.value || "0"))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Tid pr. uge (min)</span>
          <input
            type="number"
            min={30}
            max={1200}
            value={weeklyTimeMin as number}
            onChange={(e) => setWeeklyTimeMin(parseInt(e.target.value || "0"))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Seneste snit (km/uge)</span>
          <input
            type="number"
            min={0}
            max={300}
            value={historyAvgKm as number}
            onChange={(e) => setHistoryAvgKm(parseInt(e.target.value || "0"))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Uger (4–8)</span>
          <input
            type="number"
            min={4}
            max={8}
            value={historyWeeks as number}
            onChange={(e) => setHistoryWeeks(parseInt(e.target.value || "0"))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">PR 5 km (hh:mm:ss)</span>
          <input
            type="text"
            placeholder="00:25:00"
            value={pr5k}
            onChange={(e) => setPr5k(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">PR 10 km (hh:mm:ss)</span>
          <input
            type="text"
            placeholder="00:52:00"
            value={pr10k}
            onChange={(e) => setPr10k(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">PR Halvmaraton</span>
          <input
            type="text"
            placeholder="01:55:00"
            value={prHalf}
            onChange={(e) => setPrHalf(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">PR Maraton</span>
          <input
            type="text"
            placeholder="04:00:00"
            value={prMarathon}
            onChange={(e) => setPrMarathon(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="text-sm">Skadehistorik</span>
          <textarea
            rows={3}
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="text-sm">Præferencer (terræn, langtur dag, osv.)</span>
          <textarea
            rows={3}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm">Enheder</span>
          <select
            value={units}
            onChange={(e) => setUnits(e.target.value as "metric")}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="metric">km / min/km</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={useData} onChange={(e) => setUseData(e.target.checked)} />
          <span className="text-sm">Brug min Strava data (hvis tilgængelig)</span>
        </label>
      </div>
      {errorMsg && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-zinc-900 p-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-black"
          >
            {loading ? "Beregner..." : (previewPlan ? "Regenerer" : "Generér plan")}
          </button>
          <button
            type="button"
            onClick={async () => {
              // Local quick preview using planEngine (no OpenAI)
              try {
                setLoading(true);
                const { generatePlan } = await import("@/lib/planEngine");
                const distance_km = ({ "5k": 5, "10k": 10, half: 21.097, marathon: 42.195 } as any)[goalType] || 5;
                const local = generatePlan({ startDate, raceDate: targetDate || startDate, distance_km, weeklyDays });
                const fullPlan = { weeks: local.weeks, notes: local.meta?.notes || "", meta: { plan_title: "Forhåndsvisning (lokal)", plan_description: "Lokal genereret plan – kan gemmes eller regenereres." } } as any;
                setPreviewPlan(fullPlan);
                const sched = buildSchedule(fullPlan as any, startDate, undefined);
                setPreviewSchedule(sched);
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700"
          >
            Hurtig forhåndsvisning (lokal)
          </button>
        </div>
        <button
          type="button"
          disabled={!previewPlan || saving}
          onClick={savePreview}
          className="w-full rounded-lg border border-zinc-300 p-3 disabled:opacity-60 dark:border-zinc-700 sm:w-auto"
        >
          {saving ? "Gemmer..." : "Gem og vis plan"}
        </button>
      </div>

      {previewPlan && (
        <div className="space-y-3">
          <div className="text-base font-semibold">Forhåndsvisning: kalender</div>
          <MonthCalendar schedule={previewSchedule || []} onMove={() => {}} />
        </div>
      )}
    </form>
  );
}



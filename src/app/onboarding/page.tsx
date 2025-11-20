"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [distance, setDistance] = useState<"5k" | "10k" | "half" | "marathon">("5k");
  const [targetType, setTargetType] = useState<"time" | "pace">("time");
  const [targetTime, setTargetTime] = useState("");
  const [targetPace, setTargetPace] = useState("");

  const [weeklyDays, setWeeklyDays] = useState(4);
  const [weeklyTimeMin, setWeeklyTimeMin] = useState(180);

  const [prs, setPrs] = useState({ pr5k: "", pr10k: "", prHalf: "", prMarathon: "" });
  const [hasInjuryHistory, setHasInjuryHistory] = useState<boolean | null>(null);
  const [hatesHills, setHatesHills] = useState(false);
  const [hatesIntervals, setHatesIntervals] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Prefill from stored data if available
    try {
      const raw = localStorage.getItem("rc_onboarding");
      if (raw) {
        const v = JSON.parse(raw);
        setDistance(v.distance || "5k");
        setTargetType(v.targetType || "time");
        setTargetTime(v.targetTime || "");
        setTargetPace(v.targetPace || "");
        setWeeklyDays(v.weeklyDays || 4);
        setWeeklyTimeMin(v.weeklyTimeMin || 180);
        setPrs(v.prs || { pr5k: "", pr10k: "", prHalf: "", prMarathon: "" });
        setHasInjuryHistory(v.hasInjuryHistory ?? null);
        setHatesHills(v.hatesHills || false);
        setHatesIntervals(v.hatesIntervals || false);
      }
    } catch {}
  }, []);

  async function persistAndFinish() {
    setLoading(true);
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?next=/onboarding");
        return;
      }
      const userId = user.id;
      
      // Build preferences text
      const preferencesParts: string[] = [];
      if (hasInjuryHistory === true) {
        preferencesParts.push("Har skadehistorik");
      }
      if (hatesHills) {
        preferencesParts.push("Hader bakker");
      }
      if (hatesIntervals) {
        preferencesParts.push("Hader intervaller");
      }
      const preferencesText = preferencesParts.join(", ") || null;
      const injuriesText = hasInjuryHistory === true ? "Ja" : hasInjuryHistory === false ? "Nej" : null;

      // Save to settings
      await supabase.from("settings").upsert({
        user_id: userId,
        units: "metric",
        weekly_days: weeklyDays,
        weekly_time_min: weeklyTimeMin,
        prs: Object.values(prs).some(v => v) ? prs : null,
        injuries: injuriesText,
        preferences: preferencesText,
      });

      // Create plan via API
      // Convert distance to goalType
      const goalType = distance;
      
      // Determine selected days based on weeklyDays (distribute evenly across week)
      const allDays = [0, 1, 2, 3, 4, 5, 6]; // Mon-Sun
      const selectedDays = allDays.slice(0, weeklyDays).sort();
      
      // Set start date to today, end date to 12 weeks from now (or adjust based on distance)
      const startDate = new Date().toISOString().slice(0, 10);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (weeklyDays * 12 * 7)); // ~12 weeks
      const endDateStr = endDate.toISOString().slice(0, 10);

      // Create plan
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalType,
          startDate,
          endDate: endDateStr,
          selectedDays,
          targetType,
          targetTime,
          targetPace,
        }),
      });

      if (!planRes.ok) {
        throw new Error("Kunne ikke oprette plan");
      }

      const planData = await planRes.json();
      
      // Parse the plan response
      let generated: any = null;
      if (planData.weeks) {
        generated = { 
          weeks: planData.weeks, 
          notes: planData.notes || "", 
          meta: { 
            plan_title: planData.title || "Træningsplan", 
            plan_description: planData.description || "" 
          } 
        };
      }

      if (!generated) {
        throw new Error("Kunne ikke læse plan");
      }

      // Build schedule
      const { buildSchedule } = await import("@/lib/schedule");
      const dayMap: Record<string, number> = {};
      const sessionTypes = ["easy", "tempo", "interval", "long"];
      selectedDays.forEach((day, idx) => {
        const type = sessionTypes[idx % sessionTypes.length] || "easy";
        dayMap[type] = day;
      });
      if (selectedDays.includes(5) || selectedDays.includes(6)) {
        dayMap["long"] = selectedDays.includes(5) ? 5 : 6;
      }
      const schedule = buildSchedule(generated as any, startDate, dayMap, endDateStr);

      // Save day_map to settings
      await supabase.from("settings").upsert({ 
        user_id: userId, 
        day_map: dayMap 
      });

      // Save plan to database
      const distanceKmMap: Record<string, number | null> = { 
        "5k": 5, 
        "10k": 10, 
        half: 21.097, 
        marathon: 42.195 
      } as const;

      const parseTimeToSec = (val?: string) => {
        if (!val) return null;
        const parts = val.split(":").map((p) => parseInt(p, 10));
        if (parts.some((n) => Number.isNaN(n))) return null;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return null;
      };

      const dataToSave: any = {
        ...generated,
        goal: {
          distance_km: distanceKmMap[goalType] ?? null,
          distance_label: goalType,
          units: "metric",
          target_time: targetType === "time" && targetTime ? targetTime : undefined,
          target_pace: targetType === "pace" && targetPace ? targetPace : undefined,
        },
        schedule: schedule || undefined,
      };

      const target_time_sec = dataToSave.goal?.target_time ? parseTimeToSec(dataToSave.goal.target_time) : null;
      const target_pace_sec = dataToSave.goal?.target_pace ? parseTimeToSec(dataToSave.goal.target_pace) : null;

      const saveRes = await fetch("/api/plans/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDateStr,
          plan_title: generated.meta.plan_title,
          plan_description: generated.meta.plan_description,
          distance_label: goalType,
          distance_km: distanceKmMap[goalType] ?? null,
          race_date: endDateStr,
          target_time_sec,
          target_pace_sec,
          data: dataToSave,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Kunne ikke gemme plan");
      }

      // Save to localStorage for future reference
      const payload = {
        distance,
        targetType,
        targetTime,
        targetPace,
        weeklyDays,
        weeklyTimeMin,
        prs,
        hasInjuryHistory,
        hatesHills,
        hatesIntervals,
      };
      localStorage.setItem("rc_onboarding", JSON.stringify(payload));

      // Dispatch event to refresh plan
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("plan:updated"));
      }

      // Redirect to today
      router.replace("/today");
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      alert(error?.message || "Noget gik galt. Prøv igen.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white px-5 py-8 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Kom i gang</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Vi skræddersyr din plan på få trin.</p>

        {step === 1 && (
          <div className="mt-6 space-y-4">
            <div>
              <span className="text-sm">Distance</span>
              <select value={distance} onChange={(e) => setDistance(e.target.value as any)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                <option value="5k">5 km</option>
                <option value="10k">10 km</option>
                <option value="half">Halvmaraton</option>
                <option value="marathon">Maraton</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm">Måltype</span>
                <select value={targetType} onChange={(e) => setTargetType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="time">Tid</option>
                  <option value="pace">Gns. pace</option>
                </select>
              </label>
              {targetType === "time" ? (
                <label className="block">
                  <span className="text-sm">Måltid (hh:mm:ss)</span>
                  <input value={targetTime} onChange={(e) => setTargetTime(e.target.value)} placeholder="00:25:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm">Gns. pace (mm:ss pr. km)</span>
                  <input value={targetPace} onChange={(e) => setTargetPace(e.target.value)} placeholder="05:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">Næste</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm">Dage pr. uge</span>
                <input type="number" min={2} max={7} value={weeklyDays} onChange={(e) => setWeeklyDays(parseInt(e.target.value || "0"))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="block">
                <span className="text-sm">Tid pr. uge (min)</span>
                <input type="number" min={30} max={1200} value={weeklyTimeMin} onChange={(e) => setWeeklyTimeMin(parseInt(e.target.value || "0"))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Tilbage</button>
              <button onClick={() => setStep(3)} className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">Næste</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">PR'er er valgfrie - du kan springe dette trin over.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm">PR 5 km</span>
                <input value={prs.pr5k} onChange={(e) => setPrs({ ...prs, pr5k: e.target.value })} placeholder="00:25:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="block">
                <span className="text-sm">PR 10 km</span>
                <input value={prs.pr10k} onChange={(e) => setPrs({ ...prs, pr10k: e.target.value })} placeholder="00:52:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="block">
                <span className="text-sm">PR Halvmaraton</span>
                <input value={prs.prHalf} onChange={(e) => setPrs({ ...prs, prHalf: e.target.value })} placeholder="01:55:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="block">
                <span className="text-sm">PR Maraton</span>
                <input value={prs.prMarathon} onChange={(e) => setPrs({ ...prs, prMarathon: e.target.value })} placeholder="04:00:00" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Tilbage</button>
              <button onClick={() => setStep(4)} className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">Næste</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 space-y-4">
            <div>
              <span className="text-sm font-medium">Skadehistorik</span>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="injuryHistory"
                    checked={hasInjuryHistory === true}
                    onChange={() => setHasInjuryHistory(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Ja</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="injuryHistory"
                    checked={hasInjuryHistory === false}
                    onChange={() => setHasInjuryHistory(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Nej</span>
                </label>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium">Præferencer</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hatesHills}
                    onChange={(e) => setHatesHills(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                  />
                  <span className="text-sm">Hader bakker</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hatesIntervals}
                    onChange={(e) => setHatesIntervals(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                  />
                  <span className="text-sm">Hader intervaller</span>
                </label>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Tilbage</button>
              <button 
                onClick={persistAndFinish} 
                disabled={loading}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Opretter plan..." : "Fortsæt"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



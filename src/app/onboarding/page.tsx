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
  const [injuries, setInjuries] = useState("");
  const [preferences, setPreferences] = useState("");

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
        setInjuries(v.injuries || "");
        setPreferences(v.preferences || "");
      }
    } catch {}
  }, []);

  function persistAndFinish() {
    const payload = {
      distance,
      targetType,
      targetTime,
      targetPace,
      weeklyDays,
      weeklyTimeMin,
      prs,
      injuries,
      preferences,
    };
    localStorage.setItem("rc_onboarding", JSON.stringify(payload));
    // Save to Supabase settings (optional if logged in)
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("settings").upsert({
          user_id: userId,
          units: "metric",
          weekly_days: weeklyDays,
          weekly_time_min: weeklyTimeMin,
          prs,
          injuries,
          preferences,
        });
      }
    });
    router.replace("/today");
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
            <label className="block">
              <span className="text-sm">Skadehistorik</span>
              <textarea rows={3} value={injuries} onChange={(e) => setInjuries(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="block">
              <span className="text-sm">Præferencer (terræn, langtur dag, osv.)</span>
              <textarea rows={3} value={preferences} onChange={(e) => setPreferences(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">Tilbage</button>
              <button onClick={persistAndFinish} className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">Fortsæt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



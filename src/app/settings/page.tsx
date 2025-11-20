"use client";

import NavTabs from "@/components/NavTabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

const types = ["easy", "tempo", "interval", "long", "recovery", "hill"] as const;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  const [dayMap, setDayMap] = useState<Record<string, number>>({ long: 5, tempo: 1, interval: 3, easy: 0, recovery: 6, hill: 2 });
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      const { data: rows } = await supabase.from("settings").select("day_map").eq("user_id", userId).limit(1);
      if (rows && rows[0]?.day_map) setDayMap(rows[0].day_map);
    })();
  }, []);

  async function saveDayMap() {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return;
    await supabase.from("settings").upsert({ user_id: userId, day_map: dayMap });
  }
  async function handleConnect() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      router.push("/login");
      return;
    }
    window.location.href = "/api/strava/auth";
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <NavTabs />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="space-y-3">
          <div className="text-base font-semibold">Forbindelser</div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Strava</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Service mode: bruger STRAVA_ACCESS_TOKEN fra miljøvariabler. Ingen tilslutning nødvendig.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-base font-semibold">Profil & mål</div>
          <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            Brug <Link href="/onboarding" className="underline">Onboarding</Link> for at opdatere mål og præferencer.
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-base font-semibold">Konto</div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Log ud
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-base font-semibold">Planlægning: foretrukne ugedage</div>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {types.map((t) => (
                <label key={t} className="block text-sm capitalize">
                  <span className="mr-2">{t}</span>
                  <select
                    value={dayMap[t] ?? 0}
                    onChange={(e) => setDayMap({ ...dayMap, [t]: parseInt(e.target.value) })}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {weekdays.map((w, idx) => (
                      <option key={w} value={idx}>{w}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="pt-3">
              <button onClick={saveDayMap} className="rounded-lg bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-black">Gem</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



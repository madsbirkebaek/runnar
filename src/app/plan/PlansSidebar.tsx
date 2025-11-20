"use client";

import { activatePlan } from "./actions";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function PlansSidebar() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const userId = user.id;
      const { data } = await supabase
        .from("plans")
        .select("id, plan_title, distance_label, race_date, end_date, is_active, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      setPlans(data || []);
      setLoading(false);
    }
    load();

    const handler = () => load();
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
  }, []);

  if (loading) {
    return <div className="text-xs text-zinc-600 dark:text-zinc-400">Indlæser...</div>;
  }

  if (!plans || plans.length === 0) {
    return <div className="text-xs text-zinc-600 dark:text-zinc-400">Ingen planer endnu</div>;
  }

  async function handleActivate(planId: string) {
    const formData = new FormData();
    formData.append("planId", planId);
    await activatePlan(formData);
    // Reload plans
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = user.id;
    const { data } = await supabase
      .from("plans")
      .select("id, plan_title, distance_label, race_date, end_date, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setPlans(data || []);
    window.dispatchEvent(new Event("plan:updated"));
  }

  async function handleDelete(planId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Er du sikker på, at du vil slette denne plan?")) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = user.id;
    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);
    
    if (error) {
      alert("Kunne ikke slette plan: " + error.message);
      return;
    }
    
    // Reload plans
    const { data } = await supabase
      .from("plans")
      .select("id, plan_title, distance_label, race_date, end_date, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setPlans(data || []);
    window.dispatchEvent(new Event("plan:updated"));
  }

  return (
    <div className="space-y-2">
      {plans.map((p: any) => (
        <div key={p.id} className={`rounded-md border px-2 py-1.5 transition-colors ${p.is_active ? "border-zinc-900 dark:border-zinc-300 bg-zinc-50 dark:bg-zinc-900" : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}>
          <div className="flex items-start justify-between gap-2">
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => !p.is_active && handleActivate(p.id)}
            >
              <div className="text-xs font-medium truncate">{p.plan_title || "Plan"}</div>
              <div className="text-[10px] text-zinc-600 dark:text-zinc-400">
                {p.distance_label || ""} • {p.end_date || p.race_date || new Date(p.created_at).toISOString().slice(0,10)}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {p.is_active ? (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-white dark:bg-zinc-100 dark:text-black whitespace-nowrap">Aktiv</span>
              ) : (
                <button 
                  onClick={() => handleActivate(p.id)}
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  Aktiver
                </button>
              )}
              <button
                onClick={(e) => handleDelete(p.id, e)}
                className="text-zinc-400 hover:text-red-600 dark:text-zinc-600 dark:hover:text-red-400 p-1"
                title="Slet plan"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

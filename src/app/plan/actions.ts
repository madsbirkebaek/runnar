"use server";

import { reflowAfterMissed } from "@/lib/planEngine";
import { PlanData, ZPlanData } from "@/lib/types";
import { createSSRClient } from "@/lib/supabaseServerClient";
import { revalidatePath } from "next/cache";

export async function savePlan(planId: string, data: PlanData) {
  const supabase = await createSSRClient();
  const parsed = ZPlanData.parse(data);
  const { error } = await supabase.from("plans").update({ data: parsed }).eq("id", planId);
  if (error) throw new Error(error.message);
}

export async function reflowPlan(planId: string, missedDateISO: string) {
  const supabase = await createSSRClient();
  const { data, error } = await supabase.from("plans").select("id, data").eq("id", planId).single();
  if (error) throw new Error(error.message);
  const next = reflowAfterMissed(data.data as PlanData, missedDateISO);
  const { error: upErr } = await supabase.from("plans").update({ data: next }).eq("id", planId);
  if (upErr) throw new Error(upErr.message);
  return next;
}

export async function markSessionDone(planId: string, sessionId: string, dateISO: string) {
  const supabase = await createSSRClient();
  const { data, error } = await supabase.from("plans").select("id, data").eq("id", planId).single();
  if (error) throw new Error(error.message);
  const plan = data.data as PlanData;
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      if (s.id === sessionId || (s.date && s.date === dateISO)) {
        s.done = true;
      }
    }
  }
  plan.meta.updated_at = new Date().toISOString();
  const parsed = ZPlanData.parse(plan);
  const { error: upErr } = await supabase.from("plans").update({ data: parsed }).eq("id", planId);
  if (upErr) throw new Error(upErr.message);
  return parsed;
}

export async function addHoliday(planId: string, datesISO: string[]) {
  const supabase = await createSSRClient();
  const { data, error } = await supabase.from("plans").select("id, data").eq("id", planId).single();
  if (error) throw new Error(error.message);
  const plan = data.data as PlanData;
  const dates = new Set(datesISO);
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      if (s.date && dates.has(s.date)) {
        s.type = s.type === "strength" || s.type === "mobility" ? s.type : "recovery";
        s.title = "Rest / Holiday";
        s.description = "Scheduled rest due to holiday";
        s.distance_km = undefined;
        s.duration_min = undefined;
      }
    }
  }
  plan.meta.updated_at = new Date().toISOString();
  const parsed = ZPlanData.parse(plan);
  const { error: upErr } = await supabase.from("plans").update({ data: parsed }).eq("id", planId);
  if (upErr) throw new Error(upErr.message);
  return parsed;
}

export async function activatePlan(formData: FormData) {
  const supabase = await createSSRClient();
  const planId = formData.get("planId") as string;
  if (!planId) throw new Error("missing planId");

  // Identify user
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("not_authenticated");

  // Deactivate others, activate chosen
  const { error: e1 } = await supabase.from("plans").update({ is_active: false }).eq("user_id", userId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("plans").update({ is_active: true, active_at: new Date().toISOString() }).eq("id", planId).eq("user_id", userId);
  if (e2) throw e2;

  revalidatePath("/plan");
}

export type SaveGeneratedPlanInput = {
  start_date: string;
  plan_title: string;
  plan_description: string;
  distance_label: string | null;
  distance_km: number | null;
  race_date: string | null;
  target_time_sec: number | null;
  target_pace_sec: number | null;
  data: any;
};

export async function saveGeneratedPlan(input: SaveGeneratedPlanInput) {
  const supabase = await createSSRClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("not_authenticated");

  const { error } = await supabase.from("plans").insert({
    user_id: userId,
    start_date: input.start_date,
    plan_title: input.plan_title,
    plan_description: input.plan_description,
    distance_label: input.distance_label,
    distance_km: input.distance_km,
    race_date: input.race_date,
    target_time_sec: input.target_time_sec,
    target_pace_sec: input.target_pace_sec,
    data: input.data,
    is_active: true,
    active_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/plan");
}

import { NextRequest, NextResponse } from "next/server";
import { ZPlanData } from "@/lib/types";
import { generatePlan } from "@/lib/planEngine";
import { createClient } from "@supabase/supabase-js";

function sbServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { startDate, raceDate, distance_km, seedAvgKm, weeklyDays } = body || {};
  if (!startDate || !raceDate || !distance_km) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const plan = generatePlan({ startDate, raceDate, distance_km: Number(distance_km), seedAvgKm: seedAvgKm ? Number(seedAvgKm) : undefined, weeklyDays });

  const supabase = sbServer();
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;
  if (!user) return NextResponse.json(plan); // return transiently if not authenticated in this demo

  const { error } = await supabase.from("plans").insert({ user_id: user.id, start_date: startDate, data: plan });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(plan);
}

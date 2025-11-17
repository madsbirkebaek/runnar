import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabaseServerClient";

export async function POST(req: NextRequest) {
  const supabase = await createSSRClient();
  // Use default user ID for now (no authentication)
  const userId = "00000000-0000-0000-0000-000000000000";

  const body = await req.json();
  const {
    plan_id,
    start_date,
    end_date,
    plan_title,
    plan_description,
    distance_label,
    distance_km,
    race_date,
    target_time_sec,
    target_pace_sec,
    data,
  } = body || {};

  if (!plan_id || !start_date || !data) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Update existing plan
  const { error } = await supabase.from("plans").update({
    start_date,
    end_date: end_date || null,
    plan_title,
    plan_description,
    distance_label,
    distance_km,
    race_date: race_date || end_date || null,
    target_time_sec,
    target_pace_sec,
    data,
  }).eq("id", plan_id).eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}


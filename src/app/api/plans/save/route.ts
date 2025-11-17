import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabaseServerClient";

export async function POST(req: NextRequest) {
  const supabase = await createSSRClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json();
  const {
    start_date,
    plan_title,
    plan_description,
    distance_label,
    distance_km,
    race_date,
    target_time_sec,
    target_pace_sec,
    data,
  } = body || {};

  if (!start_date || !data) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { error } = await supabase.from("plans").insert({
    user_id: userId,
    start_date,
    plan_title,
    plan_description,
    distance_label,
    distance_km,
    race_date,
    target_time_sec,
    target_pace_sec,
    data,
    is_active: true,
    active_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

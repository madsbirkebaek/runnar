import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET: Hent links for en plan eller aktivitet
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const planId = searchParams.get("planId");
  const activityId = searchParams.get("activityId");

  try {
    let query = supabase.from("session_activity_links").select("*");

    if (planId) {
      query = query.eq("plan_id", planId);
    }
    if (activityId) {
      query = query.eq("activity_id", activityId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ links: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

// POST: Opret et link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, sessionDate, sessionType, activityId, matchScore } = body;

    if (!planId || !sessionDate || !sessionType || !activityId || matchScore === undefined) {
      return NextResponse.json(
        { error: "Manglende felter: planId, sessionDate, sessionType, activityId, matchScore" },
        { status: 400 }
      );
    }

    // Check if session or activity already has a link
    const { data: existingSessionLink } = await supabase
      .from("session_activity_links")
      .select("*")
      .eq("plan_id", planId)
      .eq("session_date", sessionDate)
      .eq("session_type", sessionType)
      .single();

    if (existingSessionLink) {
      // Update existing link
      const { data, error } = await supabase
        .from("session_activity_links")
        .update({ activity_id: activityId, match_score: matchScore })
        .eq("id", existingSessionLink.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ link: data });
    }

    // Check if activity already has a link
    const { data: existingActivityLink } = await supabase
      .from("session_activity_links")
      .select("*")
      .eq("activity_id", activityId)
      .single();

    if (existingActivityLink) {
      // Update existing link
      const { data, error } = await supabase
        .from("session_activity_links")
        .update({
          plan_id: planId,
          session_date: sessionDate,
          session_type: sessionType,
          match_score: matchScore,
        })
        .eq("id", existingActivityLink.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ link: data });
    }

    // Create new link
    const { data, error } = await supabase
      .from("session_activity_links")
      .insert({
        plan_id: planId,
        session_date: sessionDate,
        session_type: sessionType,
        activity_id: activityId,
        match_score: matchScore,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ link: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

// DELETE: Slet et link
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const linkId = searchParams.get("linkId");
    const planId = searchParams.get("planId");
    const sessionDate = searchParams.get("sessionDate");
    const sessionType = searchParams.get("sessionType");
    const activityId = searchParams.get("activityId");

    let query = supabase.from("session_activity_links").delete();

    if (linkId) {
      query = query.eq("id", linkId);
    } else if (planId && sessionDate && sessionType) {
      query = query.eq("plan_id", planId).eq("session_date", sessionDate).eq("session_type", sessionType);
    } else if (activityId) {
      query = query.eq("activity_id", activityId);
    } else {
      return NextResponse.json({ error: "Manglende parametre" }, { status: 400 });
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}


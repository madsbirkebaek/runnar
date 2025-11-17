import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Du er en erfaren løbetræner. Du laver sikre, progressive træningsplaner baseret på bedste praksis (polariseret træning, periodisering, restitution, skadesforebyggelse). Svar på dansk. Returnér STRIKT JSON med format: {"title":"","description":"","weeks":[{"week":1,"focus":"","total_km":0,"sessions":[{"type":"easy|tempo|interval|long|recovery|hill|other","title":"","description":"","distance_km":0,"duration_min":0,"pace_min_per_km":""}]}],"notes":""}. Ingen forklaring udenfor JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { goalType, targetDate, startDate, targetType, targetTime, targetPace, weeklyDays, weeklyTimeMin, historyAvgKm, historyWeeks, prs, injuries, preferences, units, useData } = body || {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Manglende OPENAI_API_KEY" }, { status: 400 });
  }

  const details = [
    `Mål: ${goalType}`,
    `Måldato: ${targetDate}`,
    `Startdato: ${startDate || "(auto)"}`,
    targetType === "time" ? `Måltid: ${targetTime}` : `Gns. pace: ${targetPace} min/km`,
    `Dage/uge: ${weeklyDays}`,
    weeklyTimeMin ? `Tid/uge: ${weeklyTimeMin} min` : null,
    historyAvgKm ? `Seneste snit: ${historyAvgKm} km/uge over ${historyWeeks} uger` : null,
    prs ? `PRs: 5k ${prs.pr5k||"-"}, 10k ${prs.pr10k||"-"}, HM ${prs.prHalf||"-"}, M ${prs.prMarathon||"-"}` : null,
    injuries ? `Skader: ${injuries}` : null,
    preferences ? `Præferencer: ${preferences}` : null,
    `Enheder: ${units||"metric"}`,
    useData ? `Brug Strava data hvis muligt` : `Ingen Strava data`
  ].filter(Boolean).join("\n");

  const userPrompt = `Lav en uge-for-uge plan baseret på:\n${details}\nPlanen skal matche tilgængelige dage/tid, starte konservativt ift. historik/PR og progression, og markere uger med restitution. Husk at fordele typer (Rolig, Tempo, Intervaller, Langtur).`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ plan: content });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Fejl" }, { status: 500 });
  }
}



import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Du er en erfaren løbetræner. Du laver sikre, progressive træningsplaner baseret på bedste praksis (polariseret træning, periodisering, restitution, skadesforebyggelse). Svar på dansk. Returnér STRIKT JSON med format: {"title":"","description":"","weeks":[{"week":1,"focus":"","total_km":0,"sessions":[{"type":"easy|tempo|interval|long|recovery|hill|other","title":"","description":"","distance_km":0,"duration_min":0,"pace_min_per_km":""}]}],"notes":""}. Ingen forklaring udenfor JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { goalType, startDate, endDate, selectedDays, targetType, targetTime, targetPace, targetPaceTime } = body || {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Manglende OPENAI_API_KEY" }, { status: 400 });
  }

  const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
  const selectedDayNames = (selectedDays || []).map((d: number) => weekdays[d]).join(", ");

  const goalLabels: Record<string, string> = {
    "5k": "5 km",
    "10k": "10 km",
    "half": "Halvmaraton",
    "marathon": "Maraton",
  };

  const details = [
    `Mål: ${goalLabels[goalType] || goalType}`,
    `Startdato: ${startDate || "(i dag)"}`,
    endDate ? `Slutdato: ${endDate}` : null,
    `Løbedage: ${selectedDayNames || "Ikke valgt"}`,
    `Antal løbedage pr. uge: ${selectedDays?.length || 0}`,
    targetType === "time" 
      ? `Måltid: ${targetTime || "Ikke angivet"}` 
      : `Måltype: Gns. pace ${targetPace || ""} pr. km`,
  ].filter(Boolean).join("\n");

  const userPrompt = `Lav en uge-for-uge træningsplan baseret på:\n${details}\n\nPlanen skal:\n- Være tilpasset ${goalLabels[goalType] || goalType} mål\n- Have ${selectedDays?.length || 4} træningspas pr. uge på følgende dage: ${selectedDayNames}\n- Starte fra ${startDate || "i dag"}${endDate ? ` og slutte ${endDate}` : ""}\n${targetType === "time" && targetTime ? `- Have måltid på ${targetTime}` : ""}\n${targetType === "pace" && targetPace ? `- Have gennemsnitlig pace på ${targetPace} pr. km` : ""}\n- Følge bedste praksis: polariseret træning (80% rolig, 20% hård), periodisering, progression, og inkludere restitution\n- Inkludere forskellige træningstyper: rolig løb, tempo, intervaller, og langtur\n- Være sikker og progressiv, starte konservativt og bygge gradvist op\n${endDate ? `- Planen skal passe indenfor perioden fra ${startDate} til ${endDate}` : ""}\n\nReturnér planen som JSON med uger og sessions.`;

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



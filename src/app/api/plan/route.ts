import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const SYSTEM_PROMPT = `Du er en erfaren løbetræner. Du laver sikre, progressive træningsplaner baseret på bedste praksis (polariseret træning, periodisering, restitution, skadesforebyggelse). Svar på dansk. Returnér STRIKT JSON med format: {"title":"","description":"","weeks":[{"week":1,"focus":"","total_km":0,"sessions":[{"type":"easy|tempo|interval|long|recovery|hill|other","title":"","description":"","distance_km":0,"duration_min":0,"pace_min_per_km":""}]}],"notes":""}. Ingen forklaring udenfor JSON.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { goalType, startDate, endDate, selectedDays, targetType, targetTime, targetPace, targetPaceTime } = body || {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Manglende OPENAI_API_KEY" }, { status: 400 });
  }

  // Hent historiske Strava-data for at inkludere i plan-genereringen
  const userId = "00000000-0000-0000-0000-000000000000"; // Default user ID
  let stravaStats = null;

  if (supabaseAdmin) {
    try {
      // Hent activities fra de sidste 12 uger (84 dage) for at få et godt billede af træningshistorik
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
      const twelveWeeksAgoISO = twelveWeeksAgo.toISOString().slice(0, 10);

      const { data: activities, error } = await supabaseAdmin
        .from("activities")
        .select("distance_km, duration_min, pace_min_per_km, date, type")
        .eq("user_id", userId)
        .gte("date", twelveWeeksAgoISO)
        .order("date", { ascending: false });

      if (!error && activities && activities.length > 0) {
        // Beregn statistikker
        const validPaces = activities
          .map((a) => a.pace_min_per_km)
          .filter((p): p is number => p !== null && p > 0);
        const validDistances = activities
          .map((a) => a.distance_km)
          .filter((d): d is number => d !== null && d > 0);
        const validDurations = activities
          .map((a) => a.duration_min)
          .filter((d): d is number => d !== null && d > 0);

        // Gruppér efter uge for at beregne gennemsnit pr. uge
        const weeksMap = new Map<string, { count: number; totalKm: number; paces: number[] }>();
        activities.forEach((a) => {
          if (a.date) {
            const date = new Date(a.date + "T00:00:00");
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // Mandag
            const weekKey = weekStart.toISOString().slice(0, 10);
            const week = weeksMap.get(weekKey) || { count: 0, totalKm: 0, paces: [] };
            week.count += 1;
            if (a.distance_km) week.totalKm += a.distance_km;
            if (a.pace_min_per_km && a.pace_min_per_km > 0) week.paces.push(a.pace_min_per_km);
            weeksMap.set(weekKey, week);
          }
        });

        const weeks = Array.from(weeksMap.values());
        const avgRunsPerWeek = weeks.length > 0 ? weeks.reduce((sum, w) => sum + w.count, 0) / weeks.length : 0;
        const avgKmPerWeek = weeks.length > 0 ? weeks.reduce((sum, w) => sum + w.totalKm, 0) / weeks.length : 0;
        const avgPace = validPaces.length > 0 ? validPaces.reduce((sum, p) => sum + p, 0) / validPaces.length : null;
        const medianPace = validPaces.length > 0
          ? [...validPaces].sort((a, b) => a - b)[Math.floor(validPaces.length / 2)]
          : null;
        const maxDistance = validDistances.length > 0 ? Math.max(...validDistances) : null;
        const avgDistance = validDistances.length > 0 ? validDistances.reduce((sum, d) => sum + d, 0) / validDistances.length : null;

        // Format pace til min:sec
        const formatPace = (pace: number | null): string => {
          if (!pace) return "";
          const min = Math.floor(pace);
          const sec = Math.round((pace - min) * 60);
          return `${min}:${sec.toString().padStart(2, "0")}`;
        };

        // Vælg de seneste 10-15 løb som eksempler (sorteret efter dato, nyeste først)
        const recentRuns = activities
          .filter((a) => a.date && a.distance_km && a.pace_min_per_km)
          .slice(0, 15)
          .map((a) => ({
            date: a.date,
            distance: Math.round(a.distance_km! * 10) / 10,
            pace: formatPace(a.pace_min_per_km!),
            duration: Math.round(a.duration_min || 0),
          }));

        stravaStats = {
          totalRuns: activities.length,
          weeksAnalyzed: weeks.length,
          avgRunsPerWeek: Math.round(avgRunsPerWeek * 10) / 10,
          avgKmPerWeek: Math.round(avgKmPerWeek * 10) / 10,
          avgPace: avgPace ? formatPace(avgPace) : null,
          medianPace: medianPace ? formatPace(medianPace) : null,
          maxDistance: maxDistance ? Math.round(maxDistance * 10) / 10 : null,
          avgDistance: avgDistance ? Math.round(avgDistance * 10) / 10 : null,
          recentRuns: recentRuns.length > 0 ? recentRuns : null,
        };
      }
    } catch (err) {
      console.error("Error fetching Strava stats:", err);
      // Fortsæt uden Strava-data hvis der er fejl
    }
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

  // Tilføj Strava-statistikker til prompten hvis tilgængelige
  let stravaContext = "";
  if (stravaStats) {
    const statsLines = [
      "\n\nTRÆNINGSHISTORIK (fra Strava):",
      `- Antal løb analyseret: ${stravaStats.totalRuns} løb over ${stravaStats.weeksAnalyzed} uger`,
      `- Gennemsnitlig antal løb pr. uge: ${stravaStats.avgRunsPerWeek}`,
      `- Gennemsnitlig distance pr. uge: ${stravaStats.avgKmPerWeek} km`,
      stravaStats.avgDistance ? `- Gennemsnitlig distance pr. løb: ${stravaStats.avgDistance} km` : null,
      stravaStats.maxDistance ? `- Længste løb: ${stravaStats.maxDistance} km` : null,
      stravaStats.avgPace ? `- Gennemsnitlig pace: ${stravaStats.avgPace} min/km` : null,
      stravaStats.medianPace ? `- Median pace: ${stravaStats.medianPace} min/km` : null,
    ].filter(Boolean).join("\n");

    // Tilføj eksempler på faktiske løb hvis tilgængelige
    let recentRunsText = "";
    if (stravaStats.recentRuns && stravaStats.recentRuns.length > 0) {
      recentRunsText = "\n\nEksempler på seneste løb (nyeste først):\n";
      stravaStats.recentRuns.forEach((run) => {
        const dateStr = new Date(run.date + "T00:00:00").toLocaleDateString("da-DK", {
          day: "numeric",
          month: "short",
        });
        recentRunsText += `- ${dateStr}: ${run.distance} km @ ${run.pace} min/km (${run.duration} min)\n`;
      });
      recentRunsText += "\nBrug disse eksempler til at forstå brugerens typiske distances, paces og træningsmønstre.";
    }
    
    stravaContext = `${statsLines}${recentRunsText}\n\nVIGTIGT: Brug disse historiske data til at:\n- Starte planen på et niveau der matcher brugerens nuværende træningsniveau\n- Sætte realistiske pace-mål baseret på deres faktiske præstationer\n- Tilpasse distances og intensitet til deres historiske mønstre\n- Sikre at planen bygger progressivt på deres eksisterende base\n`;
  }

  const userPrompt = `Lav en uge-for-uge træningsplan baseret på:\n${details}${stravaContext}\n\nPlanen skal:\n- Være tilpasset ${goalLabels[goalType] || goalType} mål\n- Have ${selectedDays?.length || 4} træningspas pr. uge på følgende dage: ${selectedDayNames}\n- Starte fra ${startDate || "i dag"}${endDate ? ` og slutte ${endDate}` : ""}\n${targetType === "time" && targetTime ? `- Have måltid på ${targetTime}` : ""}\n${targetType === "pace" && targetPace ? `- Have gennemsnitlig pace på ${targetPace} pr. km` : ""}\n${stravaStats ? "- Starte på et niveau der matcher brugerens nuværende træningsniveau baseret på deres historiske data\n- Bruge realistiske pace-mål der er baseret på deres faktiske præstationer\n" : ""}- Følge bedste praksis: polariseret træning (80% rolig, 20% hård), periodisering, progression, og inkludere restitution\n- Inkludere forskellige træningstyper: rolig løb, tempo, intervaller, og langtur\n- Være sikker og progressiv, starte konservativt og bygge gradvist op\n${endDate ? `- Planen skal passe indenfor perioden fra ${startDate} til ${endDate}` : ""}\n\nReturnér planen som JSON med uger og sessions.`;

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



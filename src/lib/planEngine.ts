import { addDays, differenceInCalendarWeeks, startOfWeek } from "date-fns";
import { ZPlanData, PlanData, Week, Session } from "./types";

export type PlanParams = {
  startDate: string; // ISO Monday
  raceDate: string; // ISO
  distance_km: number; // 5k..ultra
  seedAvgKm?: number; // baseline avg km/week
  weeklyDays?: number; // preferred weekly frequency
};

export function generatePlan(params: PlanParams): PlanData {
  const start = new Date(params.startDate);
  const race = new Date(params.raceDate);
  const totalWeeks = Math.max(6, differenceInCalendarWeeks(race, start) + 1);

  // Phase allocation: base/build/peak/taper with periodic deloads
  const taperWeeks = Math.max(1, Math.round(totalWeeks * 0.15));
  const peakWeeks = Math.max(1, Math.round(totalWeeks * 0.15));
  const buildWeeks = Math.max(2, Math.round(totalWeeks * 0.35));
  const baseWeeks = Math.max(2, totalWeeks - (taperWeeks + peakWeeks + buildWeeks));

  // Create week shells
  const monday = startOfWeek(start, { weekStartsOn: 1 });
  const weeks: Week[] = [];
  let focusArray: Week["focus"][] = [] as any;
  focusArray = [
    ...Array(baseWeeks).fill("base"),
    ...Array(buildWeeks).fill("build"),
    ...Array(peakWeeks).fill("peak"),
    ...Array(taperWeeks).fill("taper"),
  ];

  const seed = Math.max(10, params.seedAvgKm || 20);
  const maxDays = Math.min(7, Math.max(3, params.weeklyDays || 4));

  for (let i = 0; i < totalWeeks; i++) {
    const startDay = addDays(monday, i * 7);
    const focus = focusArray[Math.min(i, focusArray.length - 1)];

    // progressive load with deload every 3-4 weeks
    const blockIdx = Math.floor(i / 4);
    const inDeload = (i + 1) % 4 === 0 && focus !== "taper"; // deload week

    const progressionFactor = 1 + 0.08 * i; // ~8% weekly ramp before deloads
    let targetKm = Math.round(seed * progressionFactor);
    if (inDeload) targetKm = Math.round(targetKm * 0.75);
    if (focus === "taper") targetKm = Math.max(10, Math.round(targetKm * 0.6));

    const sessions: Session[] = [];

    // Allocate sessions: 1 long, 1 quality (tempo or intervals), rest easy + optional strength/mobility
    const days = maxDays;
    for (let d = 0; d < days; d++) {
      const dateISO = addDays(startDay, d).toISOString().slice(0, 10);
      let type: Session["type"] = "easy";
      let title = "Easy Run";
      let duration_min: number | undefined;
      let distance_km: number | undefined;
      let description = "";

      if (d === 5) {
        type = "long";
        title = "Long Run";
        distance_km = Math.round(targetKm * 0.35);
        description = "Steady long run. Fuel and hydrate.";
      } else if (d === 2) {
        type = focus === "build" || focus === "peak" ? "interval" : "tempo";
        title = type === "interval" ? "Intervals" : "Tempo Run";
        distance_km = Math.round(targetKm * 0.25);
        description = type === "interval" ? "Warm up, 5-8x intervals, cool down" : "20-40 min comfortably hard";
      } else if (d === 3) {
        type = "strength";
        title = "Strength & Mobility";
        description = "Full-body S&C + mobility (30-40 min).";
      } else {
        type = "easy";
        title = "Easy Run";
        distance_km = Math.round(targetKm * 0.1);
      }

      sessions.push({
        id: `${i + 1}-${d + 1}`,
        date: dateISO,
        type,
        title,
        description,
        distance_km,
        duration_min,
        planned: true,
        done: false,
      });
    }

    // Mobility add-on on Friday if not assigned
    const fri = addDays(startDay, 4).toISOString().slice(0, 10);
    if (!sessions.find(s => s.date === fri && (s.type === "strength" || s.type === "mobility"))) {
      sessions.push({ id: `${i + 1}-mob`, date: fri, type: "mobility", title: "Mobility", description: "Mobility flow 15-20 min", planned: true, done: false });
    }

    weeks.push({
      weekNumber: i + 1,
      start: startDay.toISOString().slice(0, 10),
      focus: inDeload ? "recovery" : focus,
      total_km: targetKm,
      sessions: sessions.sort((a, b) => (a.date! < b.date! ? -1 : 1)),
    });
  }

  const plan: PlanData = {
    goal: {
      distance_km: params.distance_km,
      race_date: params.raceDate,
      units: "metric",
    },
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      seed_avg_km: params.seedAvgKm,
      weekly_days: maxDays,
    },
    weeks,
  };

  return ZPlanData.parse(plan);
}

export function reflowAfterMissed(plan: PlanData, missedDateISO: string): PlanData {
  // Mark missed sessions before date as done=false and push the next quality session forward by a day
  const next = { ...plan, weeks: plan.weeks.map(w => ({ ...w, sessions: [...w.sessions] })) };
  let carryOver: Session | undefined;
  for (const w of next.weeks) {
    for (const s of w.sessions) {
      if (!s.date) continue;
      if (s.date < missedDateISO && s.planned && !s.done) {
        // missed; convert to easy 20-30 min or drop if too close
        s.type = s.type === "long" || s.type === "interval" || s.type === "tempo" ? "easy" : s.type;
        s.title = "Easy 25-30 min";
        s.distance_km = Math.max(4, (s.distance_km || 5) * 0.6);
      }
      if (s.date === missedDateISO && s.planned && !s.done && (s.type === "interval" || s.type === "tempo")) {
        carryOver = s;
        s.planned = false; // remove from today
      }
    }
  }
  if (carryOver) {
    // Insert the quality session on next available day that is easy
    for (const w of next.weeks) {
      for (const s of w.sessions) {
        if (s.date && s.date > missedDateISO && s.planned && s.type === "easy") {
          s.type = carryOver.type;
          s.title = carryOver.title;
          s.description = carryOver.description;
          s.distance_km = carryOver.distance_km;
          carryOver = undefined;
          break;
        }
      }
      if (!carryOver) break;
    }
  }
  next.meta.updated_at = new Date().toISOString();
  return ZPlanData.parse(next);
}

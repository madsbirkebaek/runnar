export type ScheduledSession = {
  date: string; // YYYY-MM-DD
  type: string;
  title?: string;
  description?: string;
  distance_km?: number;
  duration_min?: number;
  pace_min_per_km?: string;
};

// Very simple mapping: assign sessions to Mon/Tue/Thu/Sat within each week starting from startDate (Monday aligned)
export type DayMap = { [key: string]: number }; // type -> weekday (0=Mon..6=Sun)

export function buildSchedule(plan: any, startDateISO: string, dayMap?: DayMap): ScheduledSession[] {
  if (!plan?.weeks?.length) return [];
  const start = new Date(startDateISO + "T00:00:00Z");
  const monday = alignToMonday(start);
  const schedule: ScheduledSession[] = [];
  const defaultOffsets = [0, 1, 3, 5]; // Mon, Tue, Thu, Sat

  for (let w = 0; w < plan.weeks.length; w++) {
    const week = plan.weeks[w];
    const weekStart = new Date(monday);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7 * w);
    const sessions = week.sessions || [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      let dayOffset = defaultOffsets[i] ?? defaultOffsets[defaultOffsets.length - 1];
      if (dayMap && typeof dayMap[s.type] === 'number') {
        dayOffset = dayMap[s.type];
      }
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      schedule.push({
        date: d.toISOString().slice(0, 10),
        type: s.type,
        title: s.title,
        description: s.description,
        distance_km: s.distance_km,
        duration_min: s.duration_min,
        pace_min_per_km: s.pace_min_per_km,
      });
    }
  }
  return schedule;
}

function alignToMonday(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // 1..7 Mon..Sun
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}



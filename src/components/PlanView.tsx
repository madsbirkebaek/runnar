"use client";

type SessionType = "easy" | "tempo" | "interval" | "long" | "recovery" | "hill" | "other";

export type PlanSession = {
  type: SessionType;
  title?: string;
  description?: string;
  distance_km?: number;
  duration_min?: number;
  pace_min_per_km?: string;
};

export type PlanWeek = {
  week: number;
  focus?: string;
  total_km?: number;
  sessions: PlanSession[];
};

export default function PlanView({ weeks, notes }: { weeks: PlanWeek[]; notes?: string }) {
  function badgeColor(t: SessionType) {
    switch (t) {
      case "easy":
        return "bg-emerald-600";
      case "tempo":
        return "bg-sky-600";
      case "interval":
        return "bg-fuchsia-600";
      case "long":
        return "bg-orange-600";
      case "recovery":
        return "bg-lime-600";
      case "hill":
        return "bg-amber-700";
      default:
        return "bg-zinc-600";
    }
  }

  return (
    <div className="space-y-6">
      {weeks?.map((w) => (
        <div key={w.week} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-base font-semibold">Uge {w.week}</div>
            {typeof w.total_km === "number" && (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">~{w.total_km} km</div>
            )}
          </div>
          {w.focus && (
            <div className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{w.focus}</div>
          )}
          <div className="space-y-3">
            {w.sessions?.map((s, idx) => (
              <div key={idx} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-2 w-2 rounded-full ${badgeColor(s.type)}`}></span>
                  <div className="text-sm font-medium capitalize">{s.title || s.type}</div>
                </div>
                {s.description && (
                  <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{s.description}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                  {typeof s.distance_km === "number" && <span>{s.distance_km} km</span>}
                  {typeof s.duration_min === "number" && <span>{s.duration_min} min</span>}
                  {s.pace_min_per_km && <span>{s.pace_min_per_km} min/km</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {notes && (
        <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          {notes}
        </div>
      )}
    </div>
  );
}






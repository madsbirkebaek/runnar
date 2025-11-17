import { ScheduledSession } from "./schedule";

export interface Activity {
  id: number;
  date: string; // YYYY-MM-DD
  distance_km: number;
  duration_min: number;
  pace_min_per_km: number | null;
}

/**
 * Beregner match-score mellem en planlagt session og en aktivitet.
 * Returnerer en score mellem 0-100.
 */
export function computeMatchScore(session: ScheduledSession, activity: Activity): number {
  // Hvis dato ikke er den samme → returner 0
  if (session.date !== activity.date) {
    return 0;
  }

  let distanceScore = 100;
  let paceScore = 100;

  // Distance-komponent (60% vægt)
  if (session.distance_km && session.distance_km > 0) {
    const ratio = activity.distance_km / session.distance_km;
    // distanceScore = 100 - |1 - ratio| * 100 (clamp til [0, 100])
    distanceScore = Math.max(0, Math.min(100, 100 - Math.abs(1 - ratio) * 100));
  } else {
    // Hvis ingen planlagt distance, giv fuld score for distance
    distanceScore = 100;
  }

  // Pace-komponent (40% vægt)
  if (session.pace_min_per_km && activity.pace_min_per_km) {
    // Parse pace_min_per_km fra session (kan være string som "5:30" eller number)
    let targetPaceMinPerKm: number | null = null;
    if (typeof session.pace_min_per_km === "string") {
      const parts = session.pace_min_per_km.split(":");
      if (parts.length >= 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          targetPaceMinPerKm = minutes + seconds / 60;
        }
      }
    } else if (typeof session.pace_min_per_km === "number") {
      targetPaceMinPerKm = session.pace_min_per_km;
    }

    if (targetPaceMinPerKm && targetPaceMinPerKm > 0) {
      const paceRatio = activity.pace_min_per_km / targetPaceMinPerKm;
      // paceScore = 100 - |1 - paceRatio| * 100 (clamp til [0, 100])
      paceScore = Math.max(0, Math.min(100, 100 - Math.abs(1 - paceRatio) * 100));
    }
  } else {
    // Hvis ingen target pace, giv fuld score for pace
    paceScore = 100;
  }

  // Samlet score: distanceScore * 0.6 + paceScore * 0.4
  const totalScore = distanceScore * 0.6 + paceScore * 0.4;
  return Math.round(totalScore * 100) / 100; // Round to 2 decimals
}


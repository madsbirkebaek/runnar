import { describe, it, expect } from 'vitest';
import { generatePlan, reflowAfterMissed } from '@/lib/planEngine';

describe('planEngine', () => {
  it('generates progressive plan with phases and deloads', () => {
    const plan = generatePlan({ startDate: '2025-01-06', raceDate: '2025-04-20', distance_km: 42.2, seedAvgKm: 30, weeklyDays: 5 });
    expect(plan.weeks.length).toBeGreaterThanOrEqual(6);
    const focuses = new Set(plan.weeks.map(w => w.focus));
    expect(focuses.has('base')).toBe(true);
    expect(focuses.has('build')).toBe(true);
    expect(focuses.has('taper')).toBe(true);
    // At least one recovery/deload week
    expect(plan.weeks.some((w, i) => ((i + 1) % 4 === 0) && w.focus === 'recovery')).toBe(true);
  });

  it('reflows a missed quality session', () => {
    const plan = generatePlan({ startDate: '2025-01-06', raceDate: '2025-03-09', distance_km: 21.1, seedAvgKm: 25, weeklyDays: 5 });
    const missed = plan.weeks[1].sessions.find(s => s.type === 'interval' || s.type === 'tempo');
    expect(missed).toBeTruthy();
    const next = reflowAfterMissed(plan, missed!.date!);
    // The missed session should be unplanned on that date
    const sameDay = next.weeks[1].sessions.find(s => s.date === missed!.date);
    expect(sameDay?.planned).toBe(false);
  });
});

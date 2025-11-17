"use client";

import { useMemo, useState } from "react";
import { ScheduledSession } from "@/lib/schedule";

function getMonthGrid(date: Date) {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const startDay = (first.getUTCDay() + 6) % 7; // 0=Mon
  const grid: Date[] = [];
  const start = new Date(first);
  start.setUTCDate(1 - startDay);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    grid.push(d);
  }
  return grid;
}

export default function MonthCalendar({
  schedule,
  onMove,
}: {
  schedule: ScheduledSession[];
  onMove: (session: ScheduledSession, toISODate: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(new Date());
  const grid = useMemo(() => getMonthGrid(cursor), [cursor]);
  const byDate = useMemo(() => new Map(schedule.map((s) => [s.date, s])), [schedule]);

  function onDrop(e: React.DragEvent<HTMLDivElement>, toDate: string) {
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    const sess = JSON.parse(payload) as ScheduledSession;
    onMove(sess, toDate);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))} className="rounded border px-2 py-1 text-sm">Prev</button>
        <div className="text-sm font-medium">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
        <button onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))} className="rounded border px-2 py-1 text-sm">Next</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((w) => (
          <div key={w} className="px-2 py-1 text-center text-zinc-600 dark:text-zinc-400">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const sess = byDate.get(iso);
          const isOtherMonth = d.getUTCMonth() !== cursor.getUTCMonth();
          return (
            <div
              key={iso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, iso)}
              className={`min-h-20 rounded border p-2 ${isOtherMonth ? 'opacity-50' : ''}`}
            >
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{d.getUTCDate()}</div>
              {sess && (
                <div
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify(sess))}
                  className="mt-1 rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-black"
                >
                  {sess.title || sess.type}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}






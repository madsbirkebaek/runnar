"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  endDate,
  sessionLinks,
  onSessionClick,
}: {
  schedule: ScheduledSession[];
  onMove: (session: ScheduledSession, toISODate: string) => void;
  endDate?: string | null;
  sessionLinks?: Map<string, { activity_id: number; match_score: number }>; // Map from "date-type" to link
  onSessionClick?: (session: ScheduledSession) => void;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState<Date>(new Date());
  const grid = useMemo(() => getMonthGrid(cursor), [cursor]);
  const byDate = useMemo(() => new Map(schedule.map((s) => [s.date, s])), [schedule]);
  
  const today = new Date().toISOString().slice(0, 10);
  const raceDate = endDate || null;

  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleSessionClick(session: ScheduledSession, e: React.MouseEvent) {
    // If we were dragging, don't navigate
    if (isDragging) {
      return;
    }
    
    // If we have drag start position, check if mouse moved significantly
    if (dragStartPos) {
      const dx = Math.abs(e.clientX - dragStartPos.x);
      const dy = Math.abs(e.clientY - dragStartPos.y);
      // If mouse moved more than 5px, it was a drag, not a click
      if (dx > 5 || dy > 5) {
        return;
      }
    }
    
    // It was a click, call onSessionClick if provided, otherwise navigate
    if (onSessionClick) {
      onSessionClick(session);
    } else {
      router.push(`/session?date=${session.date}`);
    }
    
    // Reset drag state
    setDragStartPos(null);
    setIsDragging(false);
  }

  function handleMouseDown(e: React.MouseEvent) {
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragging(false);
  }

  function handleDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e: React.DragEvent) {
    // Reset dragging state immediately
    setIsDragging(false);
    // Only reset dragStartPos if drop was successful (check if drop target exists)
    // If drag was cancelled, we might want to allow click
    const dropEffect = e.dataTransfer.dropEffect;
    if (dropEffect === 'move' || dropEffect === 'none') {
      // Drag completed or was cancelled
      setTimeout(() => {
        setDragStartPos(null);
      }, 50);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, toDate: string) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    const sess = JSON.parse(payload) as ScheduledSession;
    // Reset drag state immediately when drop happens
    setIsDragging(false);
    setDragStartPos(null);
    onMove(sess, toDate);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button 
          type="button"
          onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))} 
          className="rounded border px-2 py-1 text-sm"
        >
          Prev
        </button>
        <div className="text-sm font-medium">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
        <button 
          type="button"
          onClick={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))} 
          className="rounded border px-2 py-1 text-sm"
        >
          Next
        </button>
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
          const isToday = iso === today;
          const isRaceDate = raceDate && iso === raceDate;
          
          return (
            <div
              key={iso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, iso)}
              className={`min-h-20 rounded border p-2 ${
                isOtherMonth ? 'opacity-50' : ''
              } ${
                isToday ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''
              } ${
                isRaceDate ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`text-xs font-medium ${
                  isToday ? 'text-blue-700 dark:text-blue-300 font-bold' : 
                  isRaceDate ? 'text-green-700 dark:text-green-300 font-bold' : 
                  'text-zinc-600 dark:text-zinc-400'
                }`}>
                  {d.getUTCDate()}
                </div>
                {isToday && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">I dag</span>
                )}
                {isRaceDate && !isToday && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">🏁 Løb</span>
                )}
              </div>
              {sess && (() => {
                const linkKey = `${sess.date}-${sess.type}`;
                const link = sessionLinks?.get(linkKey);
                const isCompleted = !!link;
                return (
                  <div
                    draggable
                    onMouseDown={handleMouseDown}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(sess));
                      handleDragStart(e);
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleSessionClick(sess, e)}
                    className={`mt-1 rounded px-2 py-1 text-xs cursor-pointer hover:opacity-90 transition-colors select-none ${
                      isCompleted
                        ? 'bg-green-600 text-white dark:bg-green-500'
                        : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                    }`}
                    title="Klik for at se detaljer eller træk for at flytte"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{sess.title || sess.type}</div>
                      {isCompleted && (
                        <span className="text-[10px]">✓</span>
                      )}
                    </div>
                    {/* Show distance and pace for running activities */}
                    {(sess.type === "easy" || sess.type === "tempo" || sess.type === "long" || sess.type === "recovery" || sess.type === "hill") && (
                      <div className="mt-0.5 text-[10px] opacity-90">
                        {typeof sess.distance_km === "number" && (
                          <span>{sess.distance_km} km</span>
                        )}
                        {typeof sess.distance_km === "number" && sess.pace_min_per_km && (
                          <span> • </span>
                        )}
                        {sess.pace_min_per_km && (
                          <span>{sess.pace_min_per_km} min/km</span>
                        )}
                      </div>
                    )}
                    {/* Show duration for interval training */}
                    {sess.type === "interval" && typeof sess.duration_min === "number" && (
                      <div className="mt-0.5 text-[10px] opacity-90">
                        {sess.duration_min} min
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}






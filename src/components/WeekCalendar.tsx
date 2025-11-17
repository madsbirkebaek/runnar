"use client";

type Day = { date: string; label: string; isToday: boolean };

function getNext7Days(): Day[] {
  const res: Day[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const isToday = i === 0;
    res.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" }),
      isToday,
    });
  }
  return res;
}

export default function WeekCalendar({ value, onChange }: { value: string; onChange: (isoDate: string) => void }) {
  const days = getNext7Days();
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {days.map((d) => {
        const active = value === d.date;
        return (
          <button
            key={d.date}
            onClick={() => onChange(d.date)}
            className={`min-w-[72px] rounded-lg border px-3 py-2 text-sm ${
              active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black" : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{d.label}</span>
              {d.isToday && <span className="text-[10px] uppercase text-emerald-600">I dag</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}






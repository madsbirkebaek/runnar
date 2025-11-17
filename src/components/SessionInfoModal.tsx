"use client";

import { ScheduledSession } from "@/lib/schedule";

export default function SessionInfoModal({
  session,
  onClose,
}: {
  session: ScheduledSession;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Træningspas detaljer</h2>
          <button
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Luk
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{session.title || session.type}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{session.date}</div>
            {session.description && (
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                {session.description}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {typeof session.distance_km === "number" && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Distance:</span> {session.distance_km} km
                </div>
              )}
              {typeof session.duration_min === "number" && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Tid:</span> {session.duration_min} min
                </div>
              )}
              {session.pace_min_per_km && (
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Pace:</span> {session.pace_min_per_km} min/km
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


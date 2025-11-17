import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">Din personlige løbetræner</h1>
          <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
            Tilpassede træningsplaner for 5k, 10k, halvmaraton og maraton. Forbind Strava,
            sæt dit mål (tid eller pace), og få en uge-for-uge plan.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-white dark:bg-zinc-100 dark:text-black">
              Kom i gang
            </Link>
            <Link href="/today" className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 dark:border-zinc-700">
              Se i dag
            </Link>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-base font-medium">Personlige planer</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Uge-for-uge struktur med rolig, tempo, intervaller og langtur.</div>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-base font-medium">Strava-integration</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Brug dine seneste uger til at sætte realistisk progression.</div>
          </div>
        </div>
      </main>
    </div>
  );
}

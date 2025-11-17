"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/activities", label: "Activities" },
  { href: "/settings", label: "Settings" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/60">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="text-lg font-semibold">RunCoach</div>
        <div className="flex gap-2 text-sm">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`${active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black" : "border border-zinc-300 dark:border-zinc-700"} rounded-full px-3 py-1.5`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}






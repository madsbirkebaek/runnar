facimport { activatePlan } from "./actions";
import { createSSRClient } from "@/lib/supabaseServerClient";

export default async function PlansSidebar() {
  const supabase = await createSSRClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) {
    return (
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        Log ind for at se dine planer
      </div>
    );
  }
  const { data: plans } = await supabase
    .from("plans")
    .select("id, plan_title, distance_label, race_date, is_active, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!plans || plans.length === 0) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-400">Ingen planer endnu</div>;
  }

  return (
    <div className="space-y-2">
      {plans.map((p: any) => (
        <form key={p.id} action={activatePlan} className={`rounded-md border px-2 py-1 ${p.is_active ? "border-zinc-900 dark:border-zinc-300" : "border-zinc-300 dark:border-zinc-700"}`}>
          <input type="hidden" name="planId" value={p.id} />
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium truncate">{p.plan_title || "Plan"}</div>
              <div className="text-[10px] text-zinc-600 dark:text-zinc-400">{p.distance_label || ""} • {(p.race_date || new Date(p.created_at).toISOString().slice(0,10))}</div>
            </div>
            {p.is_active ? (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-white dark:bg-zinc-100 dark:text-black">Aktiv</span>
            ) : (
              <button type="submit" className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] dark:border-zinc-700">Aktiver</button>
            )}
          </div>
        </form>
      ))}
    </div>
  );
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role required to bypass RLS
const admin = createClient(url, key, { auth: { persistSession: false } });

export async function readServiceToken() {
  const { data, error } = await admin.from("service_tokens").select("access_token, refresh_token, expires_at").eq("provider", "strava").single();
  if (error) return null;
  return data as { access_token: string | null; refresh_token: string | null; expires_at: number | null };
}

export async function writeServiceToken(update: { access_token?: string; refresh_token?: string; expires_at?: number }) {
  await admin.from("service_tokens").upsert({ provider: "strava", ...update, updated_at: new Date().toISOString() }, { onConflict: "provider" });
}

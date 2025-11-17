import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function supabaseFromRequest(req: Request): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const jwt = auth?.toLowerCase().startsWith("bearer ") ? auth.split(" ")[1] : undefined;
  // If a user JWT is provided, use it so RLS applies as that user.
  return createClient(url, anon, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

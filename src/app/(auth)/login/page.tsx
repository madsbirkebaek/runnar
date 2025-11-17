"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const search = useSearchParams();
  const nextPath = search.get("next") || "/today";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {

      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}${nextPath}` } });
      if (error) throw error;
      setMessage("Tjek din e-mail for login link.");
    } catch (err: any) {
      setMessage(err?.message ?? "Noget gik galt. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl font-semibold">RunCoach</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Personlig løbetræning – mobile first.</p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 text-base outline-none ring-0 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="din@email.dk"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 p-3 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-black"
          >
            {loading ? "Sender..." : "Send login-link"}
          </button>
        </form>

        <div className="mt-8">



        </div>
      </div>
    </div>
  );
}



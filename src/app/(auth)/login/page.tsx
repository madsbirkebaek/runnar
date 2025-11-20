"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const search = useSearchParams();
  const nextPath = search.get("next") || "/today";
  const error = search.get("error");

  // Check if user is already logged in
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push(nextPath);
      }
    })();
  }, [nextPath, router]);

  // Show error message if present in URL
  useEffect(() => {
    if (error) {
      setMessage(decodeURIComponent(error));
    }
  }, [error]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
      setMessage("Vi har sendt dig et login-link. Tjek din mail.");
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
          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                message.includes("sendt") || message.includes("Tjek")
                  ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              {message}
            </div>
          )}
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



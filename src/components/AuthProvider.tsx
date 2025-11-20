"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check initial session and handle PKCE flow
    const initAuth = async () => {
      // Check if we're returning from auth callback
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("auth") === "success") {
        // Clear the auth param from URL
        window.history.replaceState({}, "", window.location.pathname);
      }

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);

      // If user is logged in and on login page, redirect to today
      if (user && pathname === "/login") {
        router.push("/today");
      }
      // If user is not logged in and trying to access protected routes, redirect to login
      else if (!user && pathname !== "/login" && pathname !== "/" && !pathname.startsWith("/auth")) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        // User logged in - ensure profile exists
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          // Create profile if it doesn't exist
          await supabase.from("profiles").insert({
            id: session.user.id,
            email: session.user.email || "",
            created_at: new Date().toISOString(),
          });
        }

        // User logged in
        if (pathname === "/login") {
          router.push("/today");
        }
      } else {
        // User logged out
        if (pathname !== "/login" && pathname !== "/" && !pathname.startsWith("/auth")) {
          router.push("/login");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-dvh bg-white text-zinc-900 dark:bg-black dark:text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Indlæser...</div>
      </div>
    );
  }

  return <>{children}</>;
}


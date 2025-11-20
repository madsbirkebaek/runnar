import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/today";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // We'll handle session on client side
      autoRefreshToken: false,
    },
  });

  try {
    let user = null;

    // Handle PKCE flow (code parameter)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      user = data?.user ?? null;
    }
    // Handle token_hash flow (legacy)
    else if (token_hash && type === "email") {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: "email",
      });
      if (error) throw error;
      user = data?.user ?? null;
    }

    if (user) {
      // Use service role key to create/update profile (bypasses RLS)
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        // Check if profile exists
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code === "PGRST116") {
          // Profile doesn't exist, create it
          const { error: insertError } = await supabaseAdmin.from("profiles").insert({
            id: user.id,
            email: user.email || "",
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error("Error creating profile:", insertError);
            // Continue anyway - profile creation is not critical
          }
        } else if (!profileError && profile && (!profile.email || profile.email !== user.email)) {
          // Profile exists, but update email if it's missing or changed
          await supabaseAdmin
            .from("profiles")
            .update({ email: user.email || "" })
            .eq("id", user.id);
        }
      }

      // Redirect to the app with session - client will handle session persistence
      const redirectUrl = new URL(next, req.url);
      // Add a flag to indicate successful auth
      redirectUrl.searchParams.set("auth", "success");
      return NextResponse.redirect(redirectUrl);
    }
  } catch (err: any) {
    console.error("Error in callback:", err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Linket er udløbet eller ugyldigt. Prøv at logge ind igen.")}`, req.url)
    );
  }

  // If no valid auth parameters, redirect to login
  return NextResponse.redirect(new URL("/login", req.url));
}


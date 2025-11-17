import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSSRClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Next 16 cookies API supports (name, value, options)
          // @ts-ignore - runtime API handles options
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          // @ts-ignore - runtime API handles delete signature
          cookieStore.delete?.(name);
        },
      },
    }
  );
  return supabase;
}

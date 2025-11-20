RunCoach – Personlig løbetræning (Next.js + Tailwind + Supabase + Strava + OpenAI)

Setup

1) Miljøvariabler: brug .env.local i projektroden (Next.js loader den automatisk). Eksempel:

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Strava (service mode: no OAuth; API uses these directly)
STRAVA_ACCESS_TOKEN=
# Optional refresh mode
NEXT_PUBLIC_STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REFRESH_TOKEN=
# If you later re-enable OAuth, set the redirect
NEXT_PUBLIC_STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
STRAVA_VERIFY_TOKEN=

# OpenAI (valgfri til /api/plan)
OPENAI_API_KEY=

2) Supabase database og RLS
- Kør SQL i docs/supabase.sql i Supabase SQL editor (idempotent).
- Kør SQL i docs/auth-setup.sql for at tilføje email kolonne til profiles tabel.
- Valgfrit: docs/edge-functions.sql for event queue.

3) Supabase Auth konfiguration
- I Supabase Dashboard → Authentication → URL Configuration:
  - Sæt "Site URL" til din app URL (fx http://localhost:3000 for dev)
  - Tilføj "Redirect URLs": http://localhost:3000/auth/callback (og production URL)
- I Authentication → Providers:
  - Aktiver "Email" provider
  - Sæt "Enable email confirmations" til false (eller true hvis du vil have bekræftelse)
  - Magic Link er aktiveret som standard

3) Lokalt dev

npm install
npm run dev

Åbn http://localhost:3000

How to run tests

npm run test

Feature highlights implemented

- Passwordless email login med Supabase (magic link)
- Automatisk session management og profile oprettelse
- Plan generator (periodisering, deload, styrke/mobilitet indlagt) via src/lib/planEngine.ts og API POST /api/plans
- Strava service mode: activities fetched using STRAVA_ACCESS_TOKEN from env (no connect flow). Optional OAuth code retained but disabled.
- Supabase skemaer: tokens, profiles, plans, settings med RLS
- Zod-typer for JSON kolonner i src/lib/types.ts
- Webhook endpoint /api/strava/webhook (verification + stub)

Notes

- Ingen betalingsintegration (klar til at tilføje gating)
- Ingen hårdkodede secrets – brug .env.local

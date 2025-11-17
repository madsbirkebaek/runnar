import { readServiceToken, writeServiceToken } from "./stravaServiceStore";

export async function getServiceAccessToken(forceRefresh: boolean = false): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // Final fallback to static env token
    const direct = process.env.STRAVA_ACCESS_TOKEN;
    if (direct) return direct;
    throw new Error("Missing STRAVA client credentials. Set NEXT_PUBLIC_STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET or STRAVA_ACCESS_TOKEN.");
  }

  // 1) Try DB-stored refresh/access
  const stored = await readServiceToken();
  const now = Math.floor(Date.now() / 1000);
  if (!forceRefresh && stored?.access_token && stored.expires_at && stored.expires_at - now > 60) {
    return stored.access_token;
  }

  const refreshToken = stored?.refresh_token || process.env.STRAVA_REFRESH_TOKEN;
  if (!refreshToken) {
    // If no refresh token anywhere, try static access token
    const direct = process.env.STRAVA_ACCESS_TOKEN;
    if (direct) return direct;
    throw new Error("No Strava refresh token available. Set STRAVA_REFRESH_TOKEN or seed service_tokens row.");
  }

  // 2) Refresh token
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.message || "strava_refresh_failed");

  // Persist rotated tokens to DB for next calls
  await writeServiceToken({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at });
  return j.access_token as string;
}

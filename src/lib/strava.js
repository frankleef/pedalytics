import { getKV } from "./kv";

const TOKEN_KEY = "strava-tokens";

export async function getStoredTokens() {
  try {
    return await getKV().get(TOKEN_KEY);
  } catch { return null; }
}

async function saveTokens(tokens) {
  await getKV().set(TOKEN_KEY, tokens);
}

export async function getAccessToken() {
  const stored = await getStoredTokens();
  if (!stored) throw new Error("Niet geautoriseerd — ga naar /api/strava/auth");

  if (stored.expires_at > Date.now() / 1000 + 60) {
    return stored.access_token;
  }

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }),
  });

  if (!resp.ok) throw new Error(`Strava token refresh mislukt: ${resp.status}`);

  const data = await resp.json();
  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });

  return data.access_token;
}

export async function exchangeCode(code) {
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava OAuth mislukt: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });

  return data;
}

export async function stravaGet(path) {
  const token = await getAccessToken();
  const resp = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava API ${resp.status}: ${text}`);
  }
  return resp.json();
}

import { NextResponse } from "next/server";

export async function GET(request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "STRAVA_CLIENT_ID niet geconfigureerd" }, { status: 500 });

  const origin = new URL(request.url).origin;

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${origin}/api/strava/callback`);
  url.searchParams.set("scope", "read,activity:read");

  return NextResponse.redirect(url.toString());
}

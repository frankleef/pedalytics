import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/strava";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const origin = new URL(request.url).origin;

  if (error) return NextResponse.redirect(`${origin}/?strava=denied`);
  if (!code) return NextResponse.json({ error: "Geen code ontvangen" }, { status: 400 });

  try {
    await exchangeCode(code);
    return NextResponse.redirect(`${origin}/?strava=ok`);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

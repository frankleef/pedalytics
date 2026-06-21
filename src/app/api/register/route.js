import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip in dev als geen key geconfigureerd
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = await resp.json();
  return data.success === true;
}

export async function POST(request) {
  try {
    const { naam, email, password, turnstileToken } = await request.json();

    if (!turnstileToken) {
      return NextResponse.json({ success: false, error: "Bevestig dat je geen robot bent" }, { status: 400 });
    }
    const geldig = await verifyTurnstile(turnstileToken);
    if (!geldig) {
      return NextResponse.json({ success: false, error: "Verificatie mislukt. Probeer opnieuw." }, { status: 400 });
    }

    if (!naam || !email || !password) {
      return NextResponse.json({ success: false, error: "Alle velden zijn verplicht" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: "Wachtwoord moet minimaal 8 tekens zijn" }, { status: 400 });
    }
    await createUser({ email, password, naam });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

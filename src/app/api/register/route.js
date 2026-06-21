import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

export async function POST(request) {
  try {
    const { naam, email, password } = await request.json();
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

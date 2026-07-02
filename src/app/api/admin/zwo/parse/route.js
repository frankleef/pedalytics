import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { parseZwo } from "@/lib/zwo/parseZwo";

// Accepteert een ZWO-bestand (als tekst in de request-body), retourneert het
// geparste blok-resultaat + waarschuwingen. Slaat niets op.
export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { xml } = await request.json();
    if (typeof xml !== "string") {
      return NextResponse.json({ success: false, error: "Body moet { xml: string } zijn" }, { status: 400 });
    }

    const resultaat = parseZwo(xml);
    return NextResponse.json({ success: true, data: resultaat });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

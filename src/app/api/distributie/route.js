import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { haalDistributieAfwijking } from "@/lib/sessie/distributie";

export async function GET() {
  try {
    const user = await getSessionUser();
    const afwijking = await haalDistributieAfwijking(user?.id);
    return NextResponse.json({ success: true, data: afwijking });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

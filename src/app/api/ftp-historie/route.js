import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { vandaagISO } from "@/lib/datum";

const KEY = "ftp-historie";

export async function GET() {
  try {
    const data = await getKV().get(KEY);
    return NextResponse.json({ success: true, data: data || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { ftp, datum } = await request.json();
    if (!ftp) return NextResponse.json({ success: false, error: "FTP ontbreekt" }, { status: 400 });
    const historie = (await getKV().get(KEY)) || [];
    const iso = datum || vandaagISO();
    const bestaand = historie.findIndex(h => h.datum === iso);
    if (bestaand >= 0) historie[bestaand].ftp = ftp;
    else historie.push({ datum: iso, ftp });
    historie.sort((a, b) => a.datum.localeCompare(b.datum));
    await getKV().set(KEY, historie);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

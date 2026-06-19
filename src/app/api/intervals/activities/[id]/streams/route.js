import { NextResponse } from "next/server";
import { intervalsAuth } from "@/lib/intervals";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const resp = await fetch(
      `https://intervals.icu/api/v1/activity/${id}/streams?types=watts`,
      { headers: { Authorization: intervalsAuth() }, next: { revalidate: 0 } }
    );
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const data = await resp.json();
    const wattsStream = Array.isArray(data)
      ? data.find(s => s.type === "watts")
      : data?.watts;
    const watts = wattsStream?.data || [];
    return NextResponse.json({ success: true, watts });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

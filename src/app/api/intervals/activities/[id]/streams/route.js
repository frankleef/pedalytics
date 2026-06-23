import { NextResponse } from "next/server";
import { intervalsAuth } from "@/lib/intervals";
import { getUserIntervalsConfig } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const creds = await getUserIntervalsConfig();
    const { id } = params;
    const resp = await fetch(
      `https://intervals.icu/api/v1/activity/${id}/streams?types=watts,heartrate`,
      { headers: { Authorization: intervalsAuth(creds.apiKey) }, next: { revalidate: 0 } }
    );
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    const data = await resp.json();
    const find = (type) => (Array.isArray(data) ? data.find(s => s.type === type) : data?.[type]);
    const watts = find("watts")?.data || [];
    const heartrate = find("heartrate")?.data || [];
    return NextResponse.json({ success: true, data: { watts: { data: watts }, heartrate: { data: heartrate } } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

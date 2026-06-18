import { NextResponse } from "next/server";

const BASE_URL = "https://intervals.icu/api/v1";
const API_KEY = process.env.INTERVALS_API_KEY;

function auth() {
  return "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const resp = await fetch(`${BASE_URL}/activity/${id}`, { headers: { Authorization: auth() } });
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    return NextResponse.json({ success: true, data: await resp.json() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { rpe, gevoel, opmerking } = await request.json();
    const gevoelMap = { top: 5, goed: 4, matig: 3, moe: 2, slecht: 1 };
    const body = { perceived_exertion: rpe, feel: gevoelMap[gevoel] || 3 };
    if (opmerking) body.description = opmerking;
    const resp = await fetch(`${BASE_URL}/activity/${id}`, {
      method: "PUT",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Intervals API ${resp.status}`);
    return NextResponse.json({ success: true, data: await resp.json() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

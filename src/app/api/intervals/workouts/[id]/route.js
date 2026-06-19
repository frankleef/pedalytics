import { NextResponse } from "next/server";
import { intervalsActivityGet, intervalsActivityPut } from "@/lib/intervals";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const data = await intervalsActivityGet(id);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { rpe, gevoel, opmerking } = await request.json();
    const body = { icu_rpe: rpe };
    if (gevoel) {
      const gevoelMap = { top: 5, goed: 4, matig: 3, moe: 2, slecht: 1 };
      body.feel = gevoelMap[gevoel] || 3;
    }
    if (opmerking) body.description = opmerking;
    const data = await intervalsActivityPut(id, body);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

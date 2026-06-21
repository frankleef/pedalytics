import { NextResponse } from "next/server";
import { intervalsDelete } from "@/lib/intervals";
import { getUserIntervalsConfig } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const creds = await getUserIntervalsConfig();
    const { id } = await params;
    await intervalsDelete(`/events/${id}`, creds);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

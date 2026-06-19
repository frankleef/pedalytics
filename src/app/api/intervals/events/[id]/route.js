import { NextResponse } from "next/server";
import { intervalsDelete } from "@/lib/intervals";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await intervalsDelete(`/events/${id}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

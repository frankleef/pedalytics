import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { magSprintStaartje } from "@/lib/sessie/weekpatroon";

function planKey(userId) { return userId ? `${userId}:seizoensplan` : "seizoensplan"; }

export async function GET() {
  try {
    const user = await getSessionUser();
    const plan = await getKV().get(planKey(user?.id));
    return NextResponse.json({ success: true, data: plan || null });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

function markeerSprintStaartjesDagen(plan) {
  if (!plan?.weekSessies?.sessies || !plan?.kader) return plan;
  const sessies = plan.weekSessies.sessies;

  const weeknummerVoorSessie = (datum) => {
    if (!plan.startdatum) return 1;
    const ms = new Date(datum) - new Date(plan.startdatum);
    return Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
  };

  const sessiesPerWeek = {};
  for (const s of sessies) {
    if (!s.datum || s.voltooid) continue;
    const nr = weeknummerVoorSessie(s.datum);
    if (!sessiesPerWeek[nr]) sessiesPerWeek[nr] = [];
    sessiesPerWeek[nr].push(s);
  }

  for (const [weekNrStr, weekSessies] of Object.entries(sessiesPerWeek)) {
    const weekNr = Number(weekNrStr);
    const kw = plan.kader.find(w => w.week === weekNr);
    if (!kw || kw.fase !== 'basis' || kw.weektype === 'herstel') continue;

    const z2Sessies = weekSessies.filter(s =>
      ['z2_duur', 'z2_heuvel'].includes(s.intentie?.sessietype)
    );
    if (z2Sessies.length === 0) continue;

    const langste = z2Sessies.reduce((a, b) =>
      (a.intentie?.tss_range?.max ?? 0) >= (b.intentie?.tss_range?.max ?? 0) ? a : b
    );

    const weekObj = { ...kw, dagen: weekSessies };
    if (magSprintStaartje(weekObj, { ...langste }, null)) {
      if (!langste.intentie) langste.intentie = {};
      if (!langste.intentie.heeft_sprint_staartjes) {
        langste.intentie.heeft_sprint_staartjes = true;
        const zones = langste.intentie.toegestane_zones || ['Z2'];
        if (!zones.includes('Z7')) langste.intentie.toegestane_zones = [...zones, 'Z7'];
      }
    }
  }

  return plan;
}

export async function PUT(request) {
  try {
    const user = await getSessionUser();
    let plan = await request.json();
    plan = markeerSprintStaartjesDagen(plan);
    await getKV().set(planKey(user?.id), plan);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser();
    await getKV().del(planKey(user?.id));
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

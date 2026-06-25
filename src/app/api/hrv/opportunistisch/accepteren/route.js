import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { vandaagISO, DAGNAMEN } from "@/lib/datum";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { datum } = await request.json();
  if (!datum) return NextResponse.json({ error: "datum vereist" }, { status: 400 });

  const kv = getKV();
  const planKey = `${user.id}:seizoensplan`;
  const plan = await kv.get(planKey);
  if (!plan) return NextResponse.json({ error: "Geen plan" }, { status: 404 });

  const sessies = plan.weekSessies?.sessies || [];
  const bestaand = sessies.find(s => s.datum === datum && !s.voltooid);
  if (bestaand) return NextResponse.json({ error: "Er staat al een sessie op deze dag" }, { status: 400 });

  const dagNaam = DAGNAMEN[new Date(datum).getDay()];
  const uren = plan.urenPerDag?.[dagNaam] || 1.5;
  const duurMin = Math.min(Math.round(uren * 60), 75);

  const sessie = {
    datum,
    dag: dagNaam,
    type: "duur_variabel",
    titel: "Opportunistische Z2-rit",
    tss: 50,
    duur_min: duurMin,
    intentie: {
      rol: "aerobe_dag",
      sessietype: "z2_variabel",
      toegestane_zones: ["Z1", "Z2"],
      tss_range: { min: 40, max: 60 },
      toelichting: "Opportunistische sessie — HRV geeft ruimte voor extra volume",
    },
    opportunistisch: true,
    segmenten: [{ zone: "Z2", positie: "midden", blokDuurSeconden: duurMin * 60, isSpecifiek: false, sessietype: "z2_variabel" }],
  };

  sessies.push(sessie);
  plan.weekSessies = { ...plan.weekSessies, sessies };
  await kv.set(planKey, plan);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { DAGNAMEN } from "@/lib/datum";
import { kaderWeekVoorDatum, weekInFaseVoorKaderWeek } from "@/lib/weekgrenzen";
import { getArchetypesVoorSessietypeRaw, getArchetypesVoorSessietype, TEST_SESSIETYPES } from "@/lib/sessie-archetypes";
import { genereerRampTestSessie } from "@/lib/sessie/rampTest";

// Sectie 51-D, chunk 2, stap 2: varianten binnen een gekozen categorie.
//
// "Past binnen beschikbare tijd" leunt op het bestaande, archetype-niveau
// min_duur_min-veld (zie getArchetypesVoorSessietype in sessie-archetypes.js,
// hetzelfde mechanisme dat de automatische weekSolver/genereerSessieDag-flow al
// gebruikt) — er bestaat geen aparte, per-variant duurschatting in de KV-data.
// Alle varianten van een archetype delen dus dezelfde past_binnen_tijd-vlag.
// Niet-passende varianten worden NIET uit de lijst gefilterd (blijven zichtbaar,
// UI grijst ze uit) — vandaar twee losse getArchetypesVoorSessietype-aanroepen
// (met en zonder duur) i.p.v. één filter die ze zou laten verdwijnen.
export async function GET(request) {
  try {
    const user = await getSessionUser();
    if (!user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const datum = searchParams.get("datum");
    const categorie = searchParams.get("categorie");
    if (!datum || !categorie) {
      return NextResponse.json({ success: false, error: "datum en categorie vereist" }, { status: 400 });
    }

    const kv = getKV();
    const plan = await kv.get(`${user.id}:seizoensplan`);
    if (!plan) return NextResponse.json({ success: false, error: "Geen actief plan" }, { status: 404 });

    const dagNaam = DAGNAMEN[new Date(datum).getDay()];
    const beschikbareUren = plan.urenPerDag?.[dagNaam] ?? 1.5;
    const beschikbareDuurMin = Math.round(beschikbareUren * 60);

    if (categorie === "tests") {
      const rampTest = genereerRampTestSessie();
      const varianten = [...TEST_SESSIETYPES].filter(t => t === "ramp_test").map(sessietype => ({
        sessietype,
        archetype_id: null,
        variant_id: null,
        naam: "Ramp Test",
        omschrijving: "Vaste protocolstructuur — warming-up, stapsgewijze ramp tot uitputting, cooldown. Duur is per definitie variabel.",
        protocol: rampTest.protocol,
        duur_min_geschat: rampTest.duur_min_geschat,
        past_binnen_tijd: true,
      }));
      return NextResponse.json({ success: true, data: { categorie, varianten, beschikbareUren } });
    }

    const kaderWeek = kaderWeekVoorDatum(datum, plan.kader, plan.startdatum);
    const fase = kaderWeek?.fase ?? "basis";
    const weekInFase = weekInFaseVoorKaderWeek(kaderWeek, plan.kader);
    const seizoensdoel = plan.seizoensdoel?.type ?? null;

    const archetypesRaw = await getArchetypesVoorSessietypeRaw(categorie, kv);
    const passend = getArchetypesVoorSessietype(archetypesRaw, fase, weekInFase, seizoensdoel);
    const passendMetTijd = getArchetypesVoorSessietype(archetypesRaw, fase, weekInFase, seizoensdoel, beschikbareDuurMin);
    const fitArchetypeIds = new Set(passendMetTijd.map(a => a.id));

    const varianten = [];
    for (const archetype of passend) {
      const pastBinnenTijd = fitArchetypeIds.has(archetype.id);
      for (const variant of archetype.varianten || []) {
        varianten.push({
          sessietype: categorie,
          archetype_id: archetype.id,
          variant_id: variant.id,
          naam: `${archetype.naam} · ${variant.naam}`,
          tss_range: archetype.tss_range ?? null,
          blokken: variant.blokken,
          past_binnen_tijd: pastBinnenTijd,
          reden_uitgeschakeld: pastBinnenTijd ? null : "Past niet binnen beschikbare tijd",
        });
      }
    }

    return NextResponse.json({ success: true, data: { categorie, varianten, beschikbareUren } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

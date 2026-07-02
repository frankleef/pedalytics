import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { SESSIE_ARCHETYPES as METADATA } from "@/lib/sessie-archetypes";
import { SESSIE_ARCHETYPES as VARIANTEN } from "@/lib/sessie-varianten";

// Eenmalige migratie: voegt de metadata uit sessie-archetypes.js en de
// varianten/blokken uit sessie-varianten.js samen tot één archetype-object per
// sessietype, en schrijft dat naar archetypes:{sessietype} in KV — de nieuwe
// enige runtime-bron. Idempotent (kv.set, geen append), dus veilig opnieuw te
// draaien. Globale content, geen userId in de sleutel.
//
// naam: sessie-archetypes.js is canoniek (dat is vandaag al de naam die
// genereerSessieDeterministisch() als sessie.titel gebruikt) — sessie-varianten.js
// heeft voor 8 van de 46 archetypes een licht afwijkende naam die hier bewust
// genegeerd wordt.

function bouwMergedArchetypes() {
  const resultaat = {};
  const nu = new Date().toISOString();

  for (const [sessietype, archetypesMeta] of Object.entries(METADATA)) {
    const varianteMap = new Map((VARIANTEN[sessietype] || []).map(a => [a.id, a]));

    resultaat[sessietype] = archetypesMeta.map(meta => {
      const varianteData = varianteMap.get(meta.id);
      if (!varianteData) {
        throw new Error(`Geen variantendata gevonden voor archetype "${meta.id}" (sessietype "${sessietype}")`);
      }
      return {
        id: meta.id,
        naam: meta.naam,
        structuur: meta.structuur,
        tss_range: meta.tss_range,
        fase_beschikbaar: meta.fase_beschikbaar,
        ...(meta.week_in_fase_min != null ? { week_in_fase_min: meta.week_in_fase_min } : {}),
        ...(meta.doel_beperking ? { doel_beperking: meta.doel_beperking } : {}),
        ...(meta.vereist_lage_decoupling ? { vereist_lage_decoupling: meta.vereist_lage_decoupling } : {}),
        varianten: varianteData.varianten,
        laatst_gewijzigd: nu,
        aangemaakt_via: "seed",
      };
    });
  }
  return resultaat;
}

function diepGelijkZonderMetadata(a, b) {
  const { laatst_gewijzigd, aangemaakt_via, ...restA } = a;
  const { laatst_gewijzigd: _lg2, aangemaakt_via: _av2, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const kv = getKV();
    const merged = bouwMergedArchetypes();

    for (const [sessietype, archetypes] of Object.entries(merged)) {
      await kv.set(`archetypes:${sessietype}`, archetypes);
    }

    // Verplichte terug-lees-verificatie: elk archetype/veld moet exact overeenkomen
    // (op laatst_gewijzigd/aangemaakt_via na).
    const afwijkingen = [];
    for (const [sessietype, archetypes] of Object.entries(merged)) {
      const teruggelezen = await kv.get(`archetypes:${sessietype}`);
      if (!Array.isArray(teruggelezen) || teruggelezen.length !== archetypes.length) {
        afwijkingen.push(`${sessietype}: verwacht ${archetypes.length} archetypes, teruggelezen ${teruggelezen?.length ?? 0}`);
        continue;
      }
      for (const verwacht of archetypes) {
        const gevonden = teruggelezen.find(a => a.id === verwacht.id);
        if (!gevonden) {
          afwijkingen.push(`${sessietype}/${verwacht.id}: niet teruggevonden na schrijven`);
          continue;
        }
        if (!diepGelijkZonderMetadata(verwacht, gevonden)) {
          afwijkingen.push(`${sessietype}/${verwacht.id}: inhoud wijkt af na terug-lezen`);
        }
      }
    }

    const samenvatting = Object.fromEntries(
      Object.entries(merged).map(([sessietype, archetypes]) => [sessietype, archetypes.length])
    );
    const totaal = Object.values(samenvatting).reduce((s, n) => s + n, 0);

    if (afwijkingen.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Verificatie mislukt — KV bevat mogelijk gedeeltelijke/foutieve data",
        afwijkingen,
        samenvatting,
        totaal,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, geverifieerd: true, samenvatting, totaal });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

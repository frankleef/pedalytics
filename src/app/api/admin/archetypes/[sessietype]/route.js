import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth";
import { GELDIGE_SESSIETYPES, valideerZ1Gebruik, invalideerArchetypeCache } from "@/lib/sessie-archetypes";

function valideerArchetypesArray(sessietype, archetypes) {
  if (!Array.isArray(archetypes)) {
    return "Body moet een array van archetypes zijn";
  }

  const geziendeIds = new Set();
  for (const archetype of archetypes) {
    if (!archetype?.id) {
      return `Archetype zonder id gevonden in sessietype "${sessietype}"`;
    }
    if (geziendeIds.has(archetype.id)) {
      return `Archetype-id "${archetype.id}" komt dubbel voor in sessietype "${sessietype}"`;
    }
    geziendeIds.add(archetype.id);

    if (!archetype.structuur || typeof archetype.structuur !== "string" || !archetype.structuur.trim()) {
      return `Archetype "${archetype.id}": structuur (tekstuele omschrijving) mag niet leeg zijn`;
    }

    if (!Array.isArray(archetype.varianten) || archetype.varianten.length === 0) {
      return `Archetype "${archetype.id}": minstens 1 variant met blokken vereist`;
    }

    for (const variant of archetype.varianten) {
      if (!variant?.id) {
        return `Archetype "${archetype.id}": een variant zonder id gevonden`;
      }
      if (!Array.isArray(variant.blokken) || variant.blokken.length === 0) {
        return `Archetype "${archetype.id}"/variant "${variant.id}": minstens 1 blok vereist`;
      }
      if (!valideerZ1Gebruik(variant.blokken, sessietype, archetype.id)) {
        return `Archetype "${archetype.id}"/variant "${variant.id}": bevat een Z1-blok dat niet is toegestaan voor sessietype "${sessietype}"`;
      }
    }
  }
  return null;
}

function diepGelijkZonderMetadata(a, b) {
  if (!a || !b) return false;
  const { laatst_gewijzigd: _lgA, ...restA } = a;
  const { laatst_gewijzigd: _lgB, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

export async function PUT(request, { params }) {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { sessietype } = await params;
    if (!GELDIGE_SESSIETYPES.has(sessietype)) {
      return NextResponse.json({ success: false, error: `Onbekend sessietype "${sessietype}"` }, { status: 400 });
    }

    const archetypes = await request.json();
    const fout = valideerArchetypesArray(sessietype, archetypes);
    if (fout) {
      return NextResponse.json({ success: false, error: fout }, { status: 400 });
    }

    const kv = getKV();
    const bestaand = (await kv.get(`archetypes:${sessietype}`)) ?? [];
    const nu = new Date().toISOString();

    const opgeslagen = archetypes.map(a => {
      const oud = bestaand.find(o => o.id === a.id);
      const ongewijzigd = oud && diepGelijkZonderMetadata(a, oud);
      return {
        ...a,
        laatst_gewijzigd: ongewijzigd ? oud.laatst_gewijzigd : nu,
        aangemaakt_via: a.aangemaakt_via ?? oud?.aangemaakt_via ?? "admin_ui",
      };
    });

    await kv.set(`archetypes:${sessietype}`, opgeslagen);
    invalideerArchetypeCache(sessietype);

    return NextResponse.json({ success: true, data: opgeslagen });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

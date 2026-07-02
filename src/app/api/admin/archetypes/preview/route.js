import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { GELDIGE_SESSIETYPES, valideerZ1Gebruik } from "@/lib/sessie-archetypes";
import { genereerSessieDeterministisch } from "@/lib/sessie-generatie";

const DEFAULT_TESTDUUR_MIN = 90;
const DEFAULT_FTP = 265;

// Preview van een kandidaat-archetype — nog niet opgeslagen, geen KV-lookup.
// Draait exact dezelfde berekenfuncties als de echte sessiegeneratie
// (genereerSessieDeterministisch, die op zijn beurt berekenBlok/
// berekenTssVanBlokken/berekenVerwachtRpe gebruikt) — geen aparte
// client-side-achtige herimplementatie.
export async function POST(request) {
  try {
    const user = await getSessionUser();
    if (user?.id !== "u_frank_001") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { sessietype, archetype, variantIndex = 0, ftp, doelDuurMin } = await request.json();

    if (!GELDIGE_SESSIETYPES.has(sessietype)) {
      return NextResponse.json({ success: false, error: `Onbekend sessietype "${sessietype}"` }, { status: 400 });
    }
    if (!archetype?.id) {
      return NextResponse.json({ success: false, error: "archetype.id ontbreekt" }, { status: 400 });
    }
    const variant = archetype.varianten?.[variantIndex];
    if (!variant?.blokken?.length) {
      return NextResponse.json({ success: false, error: `Geen blokken gevonden op varianten[${variantIndex}]` }, { status: 400 });
    }
    if (!valideerZ1Gebruik(variant.blokken, sessietype, archetype.id)) {
      return NextResponse.json({ success: false, error: `Variant "${variant.id}": bevat een Z1-blok dat niet is toegestaan voor sessietype "${sessietype}"` }, { status: 400 });
    }

    const sessie = genereerSessieDeterministisch({
      dagIntentie: null,
      archetype,
      variant,
      doelDuurMin: doelDuurMin || DEFAULT_TESTDUUR_MIN,
      ftp: ftp || DEFAULT_FTP,
      sessietype,
    });

    return NextResponse.json({
      success: true,
      data: {
        blokkenMetWattages: sessie.segmenten,
        tss: sessie.tss,
        verwachtRpe: sessie.verwacht_rpe,
        duurMin: sessie.duur_min,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// Test-fixture: dezelfde merge (metadata uit sessie-archetypes.js + varianten uit
// sessie-varianten.js) als het migratiescript (/api/admin/migreer-archetypes-naar-kv)
// toepast op KV, maar hier synchroon en in-memory — zodat tests niet tegen KV
// hoeven te draaien. Dit is toegestaan gebruik van beide statische bestanden
// (testfixture, geen runtime-generatiepad).

import { SESSIE_ARCHETYPES as METADATA } from "../../sessie-archetypes";
import { SESSIE_ARCHETYPES as VARIANTEN } from "../../sessie-varianten";

function bouwMergedArchetypes() {
  const resultaat = {};
  for (const [sessietype, archetypesMeta] of Object.entries(METADATA)) {
    const varianteMap = new Map((VARIANTEN[sessietype] || []).map(a => [a.id, a]));
    resultaat[sessietype] = archetypesMeta.map(meta => {
      const varianteData = varianteMap.get(meta.id);
      return {
        id: meta.id,
        naam: meta.naam,
        structuur: meta.structuur,
        tss_range: meta.tss_range,
        fase_beschikbaar: meta.fase_beschikbaar,
        ...(meta.week_in_fase_min != null ? { week_in_fase_min: meta.week_in_fase_min } : {}),
        ...(meta.doel_beperking ? { doel_beperking: meta.doel_beperking } : {}),
        ...(meta.vereist_lage_decoupling ? { vereist_lage_decoupling: meta.vereist_lage_decoupling } : {}),
        ...(meta.toegestaan_in_herstelweek === false ? { toegestaan_in_herstelweek: false } : {}),
        ...(meta.min_duur_min != null ? { min_duur_min: meta.min_duur_min } : {}),
        ...(meta.bevat_ingebedde_intensiteit ? { bevat_ingebedde_intensiteit: true } : {}),
        varianten: varianteData?.varianten ?? [],
      };
    });
  }
  return resultaat;
}

// Volledige, gemergde archetype-map — { [sessietype]: [archetype, ...] } — zoals
// getAlleArchetypesRaw() die uit KV zou lezen.
export const ARCHETYPES_FIXTURE = bouwMergedArchetypes();

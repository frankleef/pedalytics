"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { T, zoneKleur } from "../../designTokens";
import WorkoutViz from "../WorkoutViz";
import {
  SESSIETYPE_LABELS, GELDIGE_SESSIETYPES_LIJST, ZONES, MAX_EFFORT_ZONES, ZONE_REPRESENTATIEVE_PCT,
  leegBlok, groepeerBlokkenTotSets, blokkenNaarOpslagformaat, opslagformaatNaarBlokken,
  zwoBlokkenNaarBuilderBlokken, berekenPctTotaal, PCT_TOTAAL_TOLERANTIE,
  formatDuur, ZONE_LABELS,
} from "./archetypeAdmin";

const GENERIEKE_FASES = ["basis", "sweetspot", "overgangsfase", "drempel", "consolidatie", "test"];
const SEIZOENSDOELEN = ["ftp", "klimmen", "aerobe_basis", "uithoudingsvermogen", "sprint"];
const DEBOUNCE_MS = 300;
const STANDAARD_VOORBEELDDUUR_MIN = 90;

function nieuweVariant() {
  return { id: "", naam: "", zwaartegewicht: 2, blokken: [leegBlok()] };
}

/**
 * @param {string} sessietype
 * @param {(t:string)=>void} [onSessietypeChange] - alleen meegeven als sessietype
 *   binnen dit formulier wijzigbaar moet zijn (nieuw archetype, geen archetypeInitial)
 * @param {object|null} archetypeInitial - bestaand archetype (bewerken, of basis voor
 *   "variant toevoegen aan bestaand archetype")
 * @param {boolean} [autoNieuweVariant] - voegt bij mount direct een lege variant toe en
 *   selecteert 'm, en zet de archetype-brede velden op read-only (voor de
 *   "variant op bestaand archetype"-flow vanuit de nieuw-pagina)
 */
export default function ArchetypeBuilder({ sessietype, onSessietypeChange, archetypeInitial, autoNieuweVariant, onOpgeslagen, onFout }) {
  const isNieuw = !archetypeInitial;
  const archetypeVeldenVastgezet = !isNieuw && autoNieuweVariant;

  const [id, setId] = useState(archetypeInitial?.id ?? "");
  const [naam, setNaam] = useState(archetypeInitial?.naam ?? "");
  const [structuur, setStructuur] = useState(archetypeInitial?.structuur ?? "");
  const [tssMin, setTssMin] = useState(archetypeInitial?.tss_range?.[0] ?? 60);
  const [tssMax, setTssMax] = useState(archetypeInitial?.tss_range?.[1] ?? 90);
  const [weekInFaseMin, setWeekInFaseMin] = useState(archetypeInitial?.week_in_fase_min ?? 1);
  const [faseBeschikbaar, setFaseBeschikbaar] = useState(archetypeInitial?.fase_beschikbaar ?? [...GENERIEKE_FASES]);
  const [doelBeperking, setDoelBeperking] = useState(archetypeInitial?.doel_beperking ?? []);
  const [voorbeeldDuurMin, setVoorbeeldDuurMin] = useState(STANDAARD_VOORBEELDDUUR_MIN);
  const [maxBlokduurSec, setMaxBlokduurSec] = useState(archetypeInitial?.max_blokduur_sec ?? "");
  const [minDuurMin, setMinDuurMin] = useState(archetypeInitial?.min_duur_min ?? "");

  const [varianten, setVarianten] = useState(() => {
    const bestaande = archetypeInitial?.varianten?.length
      ? archetypeInitial.varianten.map(v => ({ ...v, blokken: opslagformaatNaarBlokken(v.blokken) }))
      : [];
    return autoNieuweVariant ? [...bestaande, nieuweVariant()] : (bestaande.length ? bestaande : [nieuweVariant()]);
  });
  const [huidigeVariantIdx, setHuidigeVariantIdx] = useState(autoNieuweVariant ? (archetypeInitial?.varianten?.length ?? 0) : 0);

  const [preview, setPreview] = useState(null);
  const [previewLaden, setPreviewLaden] = useState(false);
  const [opslaan, setOpslaan] = useState(false);
  const [zwoWaarschuwingen, setZwoWaarschuwingen] = useState([]);
  const [lokaleFout, setLokaleFout] = useState(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

  const variant = varianten[huidigeVariantIdx];
  const blokken = variant?.blokken ?? [];

  const zetBlokken = useCallback((nieuweBlokken) => {
    setVarianten(v => v.map((vv, i) => (i === huidigeVariantIdx ? { ...vv, blokken: nieuweBlokken } : vv)));
  }, [huidigeVariantIdx]);

  function wijzigBlok(idx, patch) {
    zetBlokken(blokken.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function voegBlokToe(type) {
    zetBlokken([...blokken, { ...leegBlok(), type, zone: type === "herstel" ? "Z2" : "Z3", pct_ftp: type === "herstel" ? 60 : 85, pct: type === "herstel" ? 5 : 10 }]);
  }

  function verwijderBlok(idx) {
    zetBlokken(blokken.filter((_, i) => i !== idx));
  }

  function verplaatsBlok(idx, richting) {
    const nieuw = [...blokken];
    const doel = idx + richting;
    if (doel < 0 || doel >= nieuw.length) return;
    [nieuw[idx], nieuw[doel]] = [nieuw[doel], nieuw[idx]];
    zetBlokken(nieuw);
  }

  function wijzigZone(idx, zone) {
    const blok = blokken[idx];
    const patch = { zone };
    if (!MAX_EFFORT_ZONES.has(zone) || blok.maximaal) {
      patch.pct_ftp = ZONE_REPRESENTATIEVE_PCT[zone];
    }
    if (!MAX_EFFORT_ZONES.has(zone)) patch.maximaal = false;
    wijzigBlok(idx, patch);
  }

  function toggleMaximaleInspanning(idx, aan) {
    const blok = blokken[idx];
    wijzigBlok(idx, { maximaal: aan, pct_ftp: ZONE_REPRESENTATIEVE_PCT[blok.zone] });
  }

  function toggleIsSpecifiek(idx, aan) {
    wijzigBlok(idx, { isSpecifiek: aan });
  }

  function voegVariantToe() {
    setVarianten(v => [...v, nieuweVariant()]);
    setHuidigeVariantIdx(varianten.length);
  }

  function verwijderVariant(idx) {
    if (varianten.length <= 1) return;
    setVarianten(v => v.filter((_, i) => i !== idx));
    setHuidigeVariantIdx(0);
  }

  function wijzigVariantMeta(patch) {
    setVarianten(v => v.map((vv, i) => (i === huidigeVariantIdx ? { ...vv, ...patch } : vv)));
  }

  // Live preview, gedebouncet — gebruikt exact dezelfde berekenfuncties als
  // echte sessiegeneratie (/api/admin/archetypes/preview -> genereerSessieDeterministisch).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!blokken.length) { setPreview(null); return; }

    debounceRef.current = setTimeout(async () => {
      setPreviewLaden(true);
      try {
        const kandidaat = { id: id || "preview", naam, varianten: [{ id: variant.id || "v", blokken: blokkenNaarOpslagformaat(blokken) }] };
        const resp = await fetch("/api/admin/archetypes/preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessietype, archetype: kandidaat, variantIndex: 0, doelDuurMin: voorbeeldDuurMin }),
        });
        const data = await resp.json();
        if (data.success) setPreview(data.data);
        else setPreview(null);
      } catch { setPreview(null); }
      setPreviewLaden(false);
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(blokken), naam, id, sessietype, voorbeeldDuurMin]);

  async function handleZwoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const xml = await file.text();
    try {
      const resp = await fetch("/api/admin/zwo/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });
      const data = await resp.json();
      if (!data.success) { setLokaleFout(data.error); return; }
      zetBlokken(zwoBlokkenNaarBuilderBlokken(data.data.blokken));
      setZwoWaarschuwingen(data.data.waarschuwingen || []);
      if (!naam && data.data.naam) setNaam(data.data.naam);
    } catch (err) { setLokaleFout(err.message); }
    e.target.value = "";
  }

  async function handleOpslaan() {
    setLokaleFout(null);
    if (!id.trim() || !naam.trim() || !structuur.trim()) {
      setLokaleFout("Id, naam en motiverende tekst zijn verplicht.");
      return;
    }

    // Geen harde blokkade op "moet 100% zijn": schaalVariant() normaliseert de
    // aandelen altijd op hun werkelijke som, dus een afwijking is geen
    // correctheidsprobleem (zie de toelichting bij PctTotaalIndicator hieronder)
    // — een derde van de bestaande archetypes wijkt hier al af. De indicator
    // blijft staan als hulp, opslaan blokkeren zou dat inconsistent maken.
    const gevuldeVarianten = varianten.filter(v => v.blokken.length > 0);

    setOpslaan(true);
    try {
      const getResp = await fetch("/api/admin/archetypes");
      const getData = await getResp.json();
      if (!getData.success) throw new Error(getData.error || "Ophalen bestaande archetypes mislukt");

      const nieuwArchetype = {
        id: id.trim(),
        naam: naam.trim(),
        structuur: structuur.trim(),
        tss_range: [Number(tssMin), Number(tssMax)],
        fase_beschikbaar: faseBeschikbaar,
        ...(weekInFaseMin > 1 ? { week_in_fase_min: Number(weekInFaseMin) } : {}),
        ...(doelBeperking.length > 0 ? { doel_beperking: doelBeperking } : {}),
        ...(maxBlokduurSec !== "" && maxBlokduurSec != null ? { max_blokduur_sec: Number(maxBlokduurSec) } : {}),
        ...(minDuurMin !== "" && minDuurMin != null ? { min_duur_min: Number(minDuurMin) } : {}),
        varianten: gevuldeVarianten
          .map((v, i) => ({
            id: v.id.trim() || `${id.trim()}_v${i + 1}`,
            naam: v.naam.trim() || undefined,
            zwaartegewicht: Number(v.zwaartegewicht) || 2,
            blokken: blokkenNaarOpslagformaat(v.blokken),
          })),
      };

      const huidigeArray = getData.data[sessietype] ?? [];
      const bestaatAl = huidigeArray.some(a => a.id === nieuwArchetype.id);
      const nieuweArray = bestaatAl
        ? huidigeArray.map(a => (a.id === nieuwArchetype.id ? nieuwArchetype : a))
        : [...huidigeArray, nieuwArchetype];

      const putResp = await fetch(`/api/admin/archetypes/${sessietype}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nieuweArray),
      });
      const putData = await putResp.json();
      if (!putData.success) throw new Error(putData.error || "Opslaan mislukt");

      onOpgeslagen?.(nieuwArchetype);
    } catch (e) {
      setLokaleFout(e.message);
      onFout?.(e.message);
    } finally {
      setOpslaan(false);
    }
  }

  const sets = groepeerBlokkenTotSets(blokken);
  const gemFtp = berekenGemFtp(preview);
  const gebruikteZones = [...new Set((preview?.blokkenMetWattages || []).filter(s => s.type !== "herstel" && s.type !== "warmup" && s.type !== "cooldown").map(s => s.zone))];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 80px", font: "600 14px var(--font-nunito), sans-serif", color: T.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ font: "800 11px var(--font-nunito), sans-serif", letterSpacing: 1, color: T.textTert, textTransform: "uppercase", marginBottom: 4 }}>
            {isNieuw ? (autoNieuweVariant ? "Nieuwe variant" : "Nieuw archetype") : "Bewerken"}
          </div>
          <h1 style={{ font: "900 24px var(--font-nunito), sans-serif", margin: 0, letterSpacing: -0.3 }}>
            {isNieuw ? (autoNieuweVariant ? `Variant toevoegen aan "${naam}"` : "Sessie-archetype toevoegen") : naam}
          </h1>
        </div>
        <button onClick={handleOpslaan} disabled={opslaan} style={opslaanKnopStyle(opslaan)}>
          {opslaan ? "Bezig…" : "Opslaan als archetype"}
        </button>
      </div>

      {lokaleFout && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 14, marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
          {lokaleFout}
        </div>
      )}

      <div>
          <Sectie titel="Basisgegevens">
            <div style={{ display: "flex", gap: 12 }}>
              <Veld label="Naam" style={{ flex: 1 }}>
                <input value={naam} onChange={e => setNaam(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} placeholder="bv. Alles mag" />
              </Veld>
              <Veld label="Sessietype" style={{ flex: 1 }}>
                <select
                  value={sessietype}
                  onChange={e => onSessietypeChange?.(e.target.value)}
                  disabled={!onSessietypeChange || !isNieuw}
                  style={inputStyle(!onSessietypeChange || !isNieuw)}
                >
                  {GELDIGE_SESSIETYPES_LIJST.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Veld>
            </div>

            {isNieuw && (
              <Veld label="Id (uniek binnen dit sessietype)">
                <input value={id} onChange={e => setId(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} placeholder="bv. ss_lang" />
              </Veld>
            )}

            <Veld label="Motiverende tekst — verplicht">
              <textarea value={structuur} onChange={e => setStructuur(e.target.value)} disabled={archetypeVeldenVastgezet} rows={3} style={{ ...inputStyle(archetypeVeldenVastgezet), resize: "vertical", fontWeight: 500, lineHeight: 1.45 }} placeholder="bv. Na de warming-up drie korte sprints, dan een blok VO2max en een blok rond je omslagpunt..." />
              <div style={helperStyle}>Wordt getoond op het workout-scherm van de gebruiker. Geen variabelen nodig — puur statisch per archetype.</div>
            </Veld>

            <div style={{ display: "flex", gap: 12 }}>
              <Veld label="TSS min" style={{ flex: 1 }}>
                <input type="number" value={tssMin} onChange={e => setTssMin(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} />
              </Veld>
              <Veld label="TSS max" style={{ flex: 1 }}>
                <input type="number" value={tssMax} onChange={e => setTssMax(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} />
              </Veld>
              <Veld label="Min. week-in-fase" style={{ flex: 1 }}>
                <input type="number" min={1} value={weekInFaseMin} onChange={e => setWeekInFaseMin(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} />
              </Veld>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <Veld label="Maximum bloklengte (seconden, optioneel)" style={{ flex: 1 }}>
                <input type="number" min={0} value={maxBlokduurSec} onChange={e => setMaxBlokduurSec(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} placeholder="leeg = automatisch (per zone)" />
                <div style={helperStyle}>Voorkomt dat een werkblok bij een lange sessie fysiologisch te ver oprekt (bv. "4× 5' kracht" dat bij 3 uur geen 24-minuten-blok wordt). Geldt voor alle werkblokken buiten Z1/Z2. Leeg = generieke grens per zone.</div>
              </Veld>
              <Veld label="Minimale sessieduur (minuten, optioneel)" style={{ flex: 1 }}>
                <input type="number" min={0} value={minDuurMin} onChange={e => setMinDuurMin(e.target.value)} disabled={archetypeVeldenVastgezet} style={inputStyle(archetypeVeldenVastgezet)} placeholder="leeg = altijd bruikbaar" />
                <div style={helperStyle}>Dit archetype wordt nooit gekozen op een dag met minder beschikbare tijd dan dit (bv. een archetype met een vast blok van 30 min past niet in een sessie van 45 min).</div>
              </Veld>
            </div>

            <Veld label="Beschikbaar in fase(n)">
              <ChipSelectie opties={GENERIEKE_FASES} geselecteerd={faseBeschikbaar} onWijzig={setFaseBeschikbaar} disabled={archetypeVeldenVastgezet} />
            </Veld>
            <Veld label="Doel-beperking (optioneel — leeg = alle seizoensdoelen)">
              <ChipSelectie opties={SEIZOENSDOELEN} geselecteerd={doelBeperking} onWijzig={setDoelBeperking} disabled={archetypeVeldenVastgezet} />
            </Veld>

            <Veld label="Voorbeeldduur voor preview (minuten)" style={{ maxWidth: 220 }}>
              <input type="number" value={voorbeeldDuurMin} onChange={e => setVoorbeeldDuurMin(Number(e.target.value) || STANDAARD_VOORBEELDDUUR_MIN)} style={inputStyle()} />
              <div style={helperStyle}>Alle blokken zijn een percentage van de totale sessieduur — dit veld bepaalt alleen hoe die percentages omgerekend worden voor de "≈ min"-hints en de live preview hieronder.</div>
            </Veld>
          </Sectie>

          <Sectie titel="Varianten">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {varianten.map((v, i) => (
                <button key={i} onClick={() => setHuidigeVariantIdx(i)} style={variantTabStyle(i === huidigeVariantIdx)}>
                  {v.naam || v.id || `Variant ${i + 1}`}
                  {varianten.length > 1 && (
                    <span onClick={(e) => { e.stopPropagation(); verwijderVariant(i); }} style={{ marginLeft: 8, opacity: 0.6, cursor: "pointer" }}>×</span>
                  )}
                </button>
              ))}
              <button onClick={voegVariantToe} style={{ ...variantTabStyle(false), border: `1.5px dashed ${T.cardBorder}` }}>+ variant</button>
            </div>

            {variant && (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <Veld label="Variant-id" style={{ flex: 1 }}>
                    <input value={variant.id} onChange={e => wijzigVariantMeta({ id: e.target.value })} style={inputStyle()} placeholder={`bv. ${id || "archetype"}_v1`} />
                  </Veld>
                  <Veld label="Variant-naam" style={{ flex: 1 }}>
                    <input value={variant.naam} onChange={e => wijzigVariantMeta({ naam: e.target.value })} style={inputStyle()} placeholder="bv. 2× 25'" />
                  </Veld>
                  <Veld label="Zwaartegewicht (1-3)" style={{ flex: 1 }}>
                    <input type="number" min={1} max={3} value={variant.zwaartegewicht} onChange={e => wijzigVariantMeta({ zwaartegewicht: e.target.value })} style={inputStyle()} />
                  </Veld>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sets.map((set, setIdx) => {
                    const offset = sets.slice(0, setIdx).reduce((s, x) => s + x.blokken.length, 0);
                    return (
                      <div key={setIdx} style={set.reps > 1 ? setWrapperStyle : undefined}>
                        {set.reps > 1 && <div style={setLabelStyle}>×{set.reps}</div>}
                        {set.blokken.map((blok, i) => (
                          <BlokRij
                            key={blok._id}
                            blok={blok}
                            idx={offset + i}
                            totaal={blokken.length}
                            onWijzig={(patch) => wijzigBlok(offset + i, patch)}
                            onWijzigZone={(zone) => wijzigZone(offset + i, zone)}
                            onVerwijder={() => verwijderBlok(offset + i)}
                            onVerplaats={(richting) => verplaatsBlok(offset + i, richting)}
                            onToggleMax={(aan) => toggleMaximaleInspanning(offset + i, aan)}
                            onToggleSpecifiek={(aan) => toggleIsSpecifiek(offset + i, aan)}
                            voorbeeldDuurMin={voorbeeldDuurMin}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>

                <PctTotaalIndicator blokken={blokken} />

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={() => voegBlokToe("werk")} style={addBlokKnopStyle("#3E7A57")}>+ Werkblok</button>
                  <button onClick={() => voegBlokToe("herstel")} style={addBlokKnopStyle("#7A6A55")}>+ Herstelblok</button>
                  <button onClick={() => fileInputRef.current?.click()} style={secundaireKnopStyle}>ZWO uploaden</button>
                  <input ref={fileInputRef} type="file" accept=".zwo,.xml" onChange={handleZwoUpload} style={{ display: "none" }} />
                </div>

                {zwoWaarschuwingen.length > 0 && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 12, marginTop: 12, fontSize: 12.5, color: "#92400e" }}>
                    {zwoWaarschuwingen.map((w, i) => <div key={i}>⚠ {w}</div>)}
                  </div>
                )}
              </>
            )}
          </Sectie>
        </div>

        <div>
          <Sectie titel="Live preview">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              <StatTile label="Duur" waarde={preview ? `${preview.duurMin}m` : "–"} />
              <StatTile label="TSS" waarde={preview ? preview.tss : "–"} />
              <StatTile label="Gem. %FTP" waarde={preview ? `${gemFtp}%` : "–"} />
              <StatTile label="Ind. RPE" waarde={preview ? `${preview.verwachtRpe}/10` : "–"} />
            </div>

            <div style={{ background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "14px 12px 10px" }}>
              {previewLaden && <p style={{ color: T.textTert, fontSize: 13, margin: 0 }}>Berekenen…</p>}
              {!previewLaden && preview && <WorkoutViz segmenten={preview.blokkenMetWattages} ftp={265} hoogte={140} />}
              {!previewLaden && !preview && <p style={{ color: T.textTert, fontSize: 13, margin: 0 }}>Nog geen geldige blokken voor een preview.</p>}
            </div>

            {gebruikteZones.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: 14 }}>
                {gebruikteZones.map(z => (
                  <div key={z} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: T.textSec }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: zoneKleur(ZONE_REPRESENTATIEVE_PCT[z]) }} />
                    {ZONE_LABELS[z]}
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: T.textSec }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: `repeating-linear-gradient(135deg, ${T.cardBorder}, ${T.cardBorder} 2px, ${T.subtleFill} 2px, ${T.subtleFill} 4px)` }} />
                  Herstel
                </div>
              </div>
            )}

            <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 14, marginTop: 16, fontSize: 13.5, lineHeight: 1.55, color: T.textSec }}>
              <b style={{ color: T.text, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Zo ziet de gebruiker het</b>
              {structuur || <span style={{ color: T.textTert }}>Nog geen motiverende tekst ingevuld.</span>}
            </div>
          </Sectie>
        </div>
    </div>
  );
}

function berekenGemFtp(preview) {
  if (!preview?.blokkenMetWattages?.length) return 0;
  let wSom = 0, dSom = 0;
  for (const s of preview.blokkenMetWattages) {
    const gem = ((s.vermogenMin ?? 0) + (s.vermogenMax ?? 0)) / 2;
    const pct = (gem / 265) * 100; // preview draait altijd op de placeholder-FTP (265W)
    wSom += pct * (s.blokDuurSeconden || 0);
    dSom += s.blokDuurSeconden || 0;
  }
  return dSom > 0 ? Math.round(wSom / dSom) : 0;
}

function Sectie({ titel, children }) {
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, padding: 20, marginBottom: 16, boxShadow: T.cardShadow }}>
      <h2 style={{ font: "800 13px var(--font-nunito), sans-serif", margin: "0 0 16px", color: T.textTert, textTransform: "uppercase", letterSpacing: 0.5 }}>{titel}</h2>
      {children}
    </div>
  );
}

function Veld({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function StatTile({ label, waarde }) {
  return (
    <div style={{ background: T.subtleFill, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
      <div style={{ font: "600 20px var(--font-fredoka), sans-serif", color: T.text }}>{waarde}</div>
      <div style={{ font: "800 10px var(--font-nunito), sans-serif", color: T.textTert, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ChipSelectie({ opties, geselecteerd, onWijzig, disabled }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {opties.map(o => {
        const actief = geselecteerd.includes(o);
        return (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onWijzig(actief ? geselecteerd.filter(x => x !== o) : [...geselecteerd, o])}
            style={{
              padding: "6px 12px", borderRadius: 999, border: "1.5px solid",
              borderColor: actief ? "oklch(0.55 0.12 248)" : T.cardBorder,
              background: actief ? "oklch(0.95 0.03 248)" : T.cardBg,
              color: actief ? "oklch(0.4 0.1 248)" : T.textSec,
              font: "700 12px var(--font-nunito), sans-serif", cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function BlokRij({ blok, idx, totaal, onWijzig, onWijzigZone, onVerwijder, onVerplaats, onToggleMax, onToggleSpecifiek, voorbeeldDuurMin }) {
  const isMaxEffortZone = MAX_EFFORT_ZONES.has(blok.zone);
  const isVast = blok.duurType === "vast";
  const voorbeeldSec = isVast ? (blok.duurSecVast ?? 0) : ((blok.pct ?? 0) / 100) * voorbeeldDuurMin * 60;
  return (
    <div style={{ padding: "12px 12px 12px 14px", borderRadius: 14, background: T.subtleFill, border: `1px solid ${T.cardBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, background: blok.type === "herstel" ? `repeating-linear-gradient(135deg, ${T.cardBorder}, ${T.cardBorder} 2px, ${T.subtleFill} 2px, ${T.subtleFill} 4px)` : zoneKleur(blok.pct_ftp) }} />
        <div style={{ fontWeight: 800, fontSize: 13.5, flex: 1 }}>
          {blok.type === "werk" ? "Werkblok" : "Herstelblok"}
          {blok.reps > 1 && <span style={{ color: T.textTert, fontWeight: 700 }}> · {blok.reps}×</span>}
        </div>
        <button onClick={() => onVerplaats(-1)} disabled={idx === 0} style={miniKnopStyle}>↑</button>
        <button onClick={() => onVerplaats(1)} disabled={idx === totaal - 1} style={miniKnopStyle}>↓</button>
        <button onClick={onVerwijder} style={{ ...miniKnopStyle, color: "#dc2626" }}>×</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr 1fr 0.8fr", gap: 10 }}>
        <Veldje label="Zone">
          <select value={blok.zone} onChange={e => onWijzigZone(e.target.value)} style={selectStyle}>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </Veldje>
        <Veldje label="Intensiteit (%FTP)">
          <input type="number" value={blok.maximaal ? "" : blok.pct_ftp} disabled={blok.maximaal} placeholder={blok.maximaal ? "max" : ""} onChange={e => onWijzig({ pct_ftp: Number(e.target.value) })} style={inputStyle(blok.maximaal)} />
        </Veldje>
        <Veldje label={isVast ? "Duur (sec, vast)" : `Aandeel (%)${blok.reps > 1 ? " per keer" : ""}`}>
          <div style={{ display: "flex", gap: 4 }}>
            {isVast ? (
              <input type="number" min={0} value={blok.duurSecVast ?? 0} onChange={e => onWijzig({ duurSecVast: Number(e.target.value) })} style={inputStyle()} />
            ) : (
              <input type="number" min={0} step={0.1} value={blok.pct ?? 0} onChange={e => onWijzig({ pct: Number(e.target.value) })} style={inputStyle()} />
            )}
            <button
              type="button"
              onClick={() => onWijzig({ duurType: isVast ? "pct" : "vast" })}
              title={isVast ? "Wissel naar percentage van de sessieduur" : "Wissel naar een vaste duur in seconden"}
              style={{ ...miniKnopStyle, flexShrink: 0 }}
            >⇄</button>
          </div>
        </Veldje>
        <Veldje label="Herhalingen">
          <input type="number" min={1} value={blok.reps ?? 1} onChange={e => onWijzig({ reps: Number(e.target.value) })} style={inputStyle()} />
        </Veldje>
      </div>

      {isVast && (
        <div style={{ fontSize: 11.5, color: "#c2410c", marginTop: 6, fontWeight: 700 }}>
          Vaste duur — schaalt nooit mee met de sessielengte en telt niet mee in het percentage-totaal hieronder.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
        {isMaxEffortZone && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.textSec }}>
            <input type="checkbox" checked={!!blok.maximaal} onChange={e => onToggleMax(e.target.checked)} />
            Maximale inspanning (geen vast %FTP — gebaseerd op pieksprintcapaciteit)
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.textSec }}>
          <input type="checkbox" checked={!!blok.isSpecifiek} onChange={e => onToggleSpecifiek(e.target.checked)} />
          Nauwe marge (±8,5% i.p.v. ±10% rond de intensiteit)
        </label>
      </div>
      <div style={{ fontSize: 10.5, color: T.textTert, marginTop: 6 }}>
        {isVast
          ? `= ${formatDuur(voorbeeldSec)}, altijd (ongeacht sessieduur)${blok.reps > 1 ? ` (× ${blok.reps})` : ""}`
          : `≈ ${formatDuur(voorbeeldSec)} bij een sessie van ${voorbeeldDuurMin} min${blok.reps > 1 ? ` (× ${blok.reps})` : ""}`}
      </div>
    </div>
  );
}

// Puur informatief, geen harde eis: schaalVariant() normaliseert de aandelen
// altijd op hun werkelijke som (zie handleOpslaan hierboven) — een afwijking
// van 100% wordt dus automatisch gecorrigeerd bij generatie, geen fout. De
// indicator helpt alleen om per ongeluk scheve verhoudingen te herkennen.
function PctTotaalIndicator({ blokken }) {
  const totaal = berekenPctTotaal(blokken);
  const ok = Math.abs(totaal - 100) <= PCT_TOTAAL_TOLERANTIE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: ok ? "#2F9468" : "#c2410c" }}>
      {ok ? "✓" : "⚠"} Totaal: {totaal.toFixed(1)}%{!ok && " (wordt automatisch genormaliseerd — dit is alleen een hint)"}
    </div>
  );
}

function Veldje({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: T.textTert, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = (disabled) => ({
  width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${T.cardBorder}`,
  background: disabled ? T.subtleFill : T.cardBg, color: T.text, font: "600 13px var(--font-nunito), sans-serif",
  boxSizing: "border-box", opacity: disabled ? 0.7 : 1,
});
const helperStyle = { fontSize: 12, color: T.textTert, marginTop: 5, lineHeight: 1.4 };
const selectStyle = { ...inputStyle(), padding: "7px 8px", font: "600 12px var(--font-nunito), sans-serif" };
const miniKnopStyle = { width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.cardBg, cursor: "pointer", fontSize: 12, color: T.textSec };
const secundaireKnopStyle = { padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${T.cardBorder}`, background: T.cardBg, color: T.textSec, font: "700 12.5px var(--font-nunito), sans-serif", cursor: "pointer" };
const addBlokKnopStyle = (kleur) => ({ flex: 1, padding: 11, borderRadius: 12, border: `1.5px dashed ${T.cardBorder}`, background: "transparent", color: kleur, font: "800 12.5px var(--font-nunito), sans-serif", cursor: "pointer" });
const variantTabStyle = (actief) => ({
  padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${actief ? "oklch(0.55 0.12 248)" : T.cardBorder}`,
  background: actief ? "oklch(0.95 0.03 248)" : T.cardBg, color: actief ? "oklch(0.4 0.1 248)" : T.textSec,
  font: "700 12.5px var(--font-nunito), sans-serif", cursor: "pointer",
});
const setWrapperStyle = { position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: "16px 12px 12px", border: `1.5px dashed ${T.cardBorder}`, borderRadius: 14, marginLeft: 6, borderLeft: `2px dashed ${T.divider}` };
const setLabelStyle = { position: "absolute", top: -11, left: 12, background: T.cardBg, padding: "1px 8px", borderRadius: 999, font: "800 11px var(--font-nunito), sans-serif", color: "oklch(0.5 0.12 248)", border: `1px solid oklch(0.8 0.06 248)` };
const opslaanKnopStyle = (bezig) => ({
  padding: "12px 22px", borderRadius: T.pillRadius, border: "none", background: T.slate,
  color: "oklch(0.97 0.01 84)", font: "800 14.5px var(--font-nunito), sans-serif", cursor: bezig ? "default" : "pointer", opacity: bezig ? 0.6 : 1, whiteSpace: "nowrap",
});

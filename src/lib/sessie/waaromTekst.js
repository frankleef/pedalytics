import { claudeCall } from "../claude";

function relatieveDag(referentie, andere) {
  const diff = Math.round((new Date(andere) - new Date(referentie)) / 86400000);
  if (diff === -1) return "gisteren";
  if (diff === 0) return "vandaag";
  if (diff === 1) return "morgen";
  if (diff === -2) return "eergisteren";
  if (diff === 2) return "overmorgen";
  if (diff < 0) return `${Math.abs(diff)} dagen geleden`;
  return `over ${diff} dagen`;
}

export async function genereerWaaromTekst({ datum, sessie, weekSessies }) {
  const dagIndex = weekSessies
    .filter(s => s.intentie && s.datum !== datum)
    .map(s => `${relatieveDag(datum, s.datum)}: ${s.intentie?.rol || s.type} (${s.intentie?.sessietype || s.type})`)
    .join(", ");

  const prompt = `Schrijf de "Waarom vandaag"-toelichting voor een trainingsdag.

Sessie op ${datum}:
- Rol: ${sessie.intentie?.rol || sessie.type}
- Sessietype: ${sessie.intentie?.sessietype || sessie.type}
- Titel: ${sessie.titel || "onbekend"}
- TSS: ${sessie.tss || "?"}

Andere sessies deze week (relatief t.o.v. deze dag):
${dagIndex || "geen andere sessies"}

Schrijf 2-3 zinnen, max 60 woorden, Nederlands, tweede persoon, coachende toon.
Gebruik alleen relatieve dagaanduidingen (gisteren, morgen, eerder deze week) — nooit vaste dagnamen of datums.
Geef ALLEEN de tekst terug, geen JSON, geen aanhalingstekens.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 150, system: "Je bent een persoonlijke fietstrainer. Korte, heldere uitleg in mensentaal.", messages: [{ role: "user", content: prompt }] }),
    });
    const data = await resp.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function vernieuwWaaromTekstenWeek(sessies, gewijzigdeDatums) {
  const vandaag = new Date().toISOString().slice(0, 10);
  const geraakteWeken = new Set();
  (gewijzigdeDatums || []).forEach(d => {
    const dt = new Date(d); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    geraakteWeken.add(dt.toISOString().slice(0, 10));
  });

  const bijgewerkt = [];

  for (const weekStart of geraakteWeken) {
    const weekEind = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const weekSessies = sessies.filter(s => s.datum >= weekStart && s.datum < weekEind && !s.voltooid);

    for (const s of weekSessies) {
      if (s.datum < vandaag) continue;
      if (gewijzigdeDatums?.includes(s.datum)) continue;

      const tekst = await genereerWaaromTekst({ datum: s.datum, sessie: s, weekSessies });
      if (tekst) {
        s.waarom_vandaag = tekst;
        bijgewerkt.push(s.datum);
      }
    }
  }

  return bijgewerkt;
}

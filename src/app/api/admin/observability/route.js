import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getKV } from "@/lib/kv";

async function hogql(query) {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Onverwacht antwoord (status ${res.status}, geen JSON): ${raw.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data?.detail || `HogQL-query mislukt (status ${res.status})`);
  // PostHog geeft { columns, results } terug — vouw om naar array van objecten.
  const columns = data.columns || [];
  return (data.results || []).map(row => Object.fromEntries(row.map((v, i) => [columns[i], v])));
}

// Sectie 44-C, 5 onderdelen. voltooiingsratio leunt op sessie_voltooid (gelogd
// sinds cron/sync/route.js:375) én sessie_overgeslagen (gelogd sinds C1,
// cron/compliance-check/route.js) — deze query zou dus voor beide helften
// data moeten tonen. TSS-progressie/uitvoeringsscore-trend leunden oorspronkelijk
// op dezelfde aanname; die queries zijn correct HogQL en tonen vanzelf data
// zodra de betreffende events voorkomen.
const QUERIES = {
  archetypeRotatie: `
    SELECT properties.sessietype AS sessietype, properties.archetype_id AS archetype_id, count() AS aantal
    FROM events
    WHERE event = 'sessie_gegenereerd' AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY sessietype, archetype_id
    ORDER BY sessietype, aantal DESC
  `,
  voltooiingsratio: `
    SELECT properties.sessietype AS sessietype, event, count() AS aantal
    FROM events
    WHERE event IN ('sessie_voltooid', 'sessie_overgeslagen') AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY sessietype, event
    ORDER BY sessietype
  `,
  generatieBetrouwbaarheid: `
    SELECT toDate(timestamp) AS dag, event, count() AS aantal
    FROM events
    WHERE event IN ('archetype_niet_gevonden', 'generatie_fout', 'duur_cap_toegepast') AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY dag, event
    ORDER BY dag
  `,
  tssProgressie: `
    SELECT toStartOfWeek(timestamp) AS week,
           avg(toFloat(properties.tss_werkelijk)) AS tss_werkelijk,
           avg(toFloat(properties.tss_doel)) AS tss_doel
    FROM events
    WHERE event = 'sessie_voltooid' AND timestamp > now() - INTERVAL 90 DAY
    GROUP BY week
    ORDER BY week
  `,
  uitvoeringsscoreTrend: `
    SELECT toStartOfWeek(timestamp) AS week,
           avg(toFloat(properties.uitvoeringsscore)) AS gem_uitvoeringsscore
    FROM events
    WHERE event = 'sessie_voltooid' AND timestamp > now() - INTERVAL 90 DAY
    GROUP BY week
    ORDER BY week
  `,
};

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sequentieel i.p.v. Promise.all — 5 gelijktijdige requests naar PostHog
  // triggerden soms een non-JSON (HTML) antwoord, vermoedelijk rate-limiting.
  const entries = [];
  for (const [naam, query] of Object.entries(QUERIES)) {
    try {
      entries.push([naam, { data: await hogql(query) }]);
    } catch (e) {
      console.error(`[admin/observability] query "${naam}" mislukt:`, e.message);
      entries.push([naam, { error: e.message }]);
    }
  }
  const resultaat = Object.fromEntries(entries);

  // KPI-strip: afgeleid uit de al opgehaalde queries hierboven (geen extra
  // HogQL-calls) + één KV-lookup voor het aantal actieve sporters.
  let actieveSporters = null;
  try {
    actieveSporters = ((await getKV().get("users:active")) || []).length;
  } catch (e) {
    console.error("[admin/observability] users:active ophalen mislukt:", e.message);
  }

  const archetypeRijen = resultaat.archetypeRotatie?.data;
  const sessiesGegenereerd30d = archetypeRijen
    ? archetypeRijen.reduce((s, r) => s + (r.aantal || 0), 0)
    : null;

  const betrouwbaarheidRijen = resultaat.generatieBetrouwbaarheid?.data;
  const generatieFouten30d = betrouwbaarheidRijen
    ? betrouwbaarheidRijen.filter(r => r.event !== "duur_cap_toegepast").reduce((s, r) => s + (r.aantal || 0), 0)
    : null;

  const voltooiingsRijen = resultaat.voltooiingsratio?.data;
  let gemVoltooiingsratio30d = null;
  if (voltooiingsRijen) {
    const totalen = voltooiingsRijen.reduce((acc, r) => {
      if (r.event === "sessie_voltooid") acc.voltooid += r.aantal;
      else acc.overgeslagen += r.aantal;
      return acc;
    }, { voltooid: 0, overgeslagen: 0 });
    const totaal = totalen.voltooid + totalen.overgeslagen;
    gemVoltooiingsratio30d = totaal > 0 ? Math.round((totalen.voltooid / totaal) * 100) : null;
  }

  resultaat.kpis = { actieveSporters, sessiesGegenereerd30d, generatieFouten30d, gemVoltooiingsratio30d };

  return NextResponse.json(resultaat);
}

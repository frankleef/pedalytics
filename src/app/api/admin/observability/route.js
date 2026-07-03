import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

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
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || `HogQL-query mislukt (status ${res.status})`);
  // PostHog geeft { columns, results } terug — vouw om naar array van objecten.
  const columns = data.columns || [];
  return (data.results || []).map(row => Object.fromEntries(row.map((v, i) => [columns[i], v])));
}

// Sectie 44-C, 5 onderdelen. Voltooiingsratio/TSS-progressie/uitvoeringsscore-trend
// leunen op sessie_voltooid, dat (nog) niet gelogd wordt — geen server-side
// state-transitie beschikbaar (zie sectie 44-observability-gesprek). Die drie
// queries zijn wel al correct HogQL en beginnen vanzelf data te tonen zodra dat
// event ooit wordt toegevoegd; tot dan geven ze lege resultaten, geen fout.
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

  const entries = await Promise.all(
    Object.entries(QUERIES).map(async ([naam, query]) => {
      try {
        return [naam, { data: await hogql(query) }];
      } catch (e) {
        console.error(`[admin/observability] query "${naam}" mislukt:`, e.message);
        return [naam, { error: e.message }];
      }
    })
  );

  return NextResponse.json(Object.fromEntries(entries));
}

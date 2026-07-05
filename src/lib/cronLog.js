import { getKV } from "./kv";

// Samenvat een cron-run naar cronrun:{naam}:laatst — bron voor de admin
// Jobs & cron-kaarten. TTL van 7 dagen: lang genoeg om één gemiste run te
// overleven, kort genoeg dat een structureel kapotte cron uiteindelijk als
// "onbekend" i.p.v. voor altijd als "laatst geslaagd" wordt getoond.
export async function logCronRun(naam, { startedAt, results, ttlSeconden = 7 * 86400 }) {
  const fouten = results.filter(r => r.status === "error").length;
  const status = results.length === 0 || fouten === 0
    ? "geslaagd"
    : fouten === results.length ? "mislukt" : "let_op";

  const resultsSummary = {};
  for (const r of results) resultsSummary[r.status] = (resultsSummary[r.status] || 0) + 1;

  await getKV().set(`cronrun:${naam}:laatst`, {
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    status,
    verwerkt: results.length,
    resultsSummary,
  }, { ex: ttlSeconden });
}

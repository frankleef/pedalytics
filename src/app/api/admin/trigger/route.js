import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Eén sessie-gegate endpoint dat alle secret-beveiligde onderhoud/cron-routes
// server-side aanroept — de admin-UI ziet nooit ADMIN_SECRET/CRON_SECRET zelf,
// alleen deze proxy injecteert het juiste geheim per actie.
const ADMIN_SECRET_HEADERS = () => ({ authorization: `Bearer ${process.env.ADMIN_SECRET}` });
const CRON_SECRET_HEADERS = () => ({ "x-cron-secret": process.env.CRON_SECRET });

const ACTIES = {
  "cron-morning": { pad: "/api/cron/morning" },
  "cron-sync": { pad: "/api/cron/sync" },
  "cron-sessies-aanvullen": { pad: "/api/cron/sessies-aanvullen" },
  "herbereken-sessies": { pad: "/api/admin/herbereken-sessies" },
  "rond-sessieduren-af": { pad: "/api/admin/rond-sessieduren-af" },
  "herbereken-conditiescore": { pad: "/api/admin/herbereken-conditiescore" },
  "herbereken-fitnessprogressie": { pad: "/api/admin/herbereken-fitnessprogressie", vereistUserId: true },
  "herbereken-hrv-profiel": { pad: "/api/admin/herbereken-hrv-profiel" },
  "herbereken-rpe-gisteren": { pad: "/api/admin/herbereken-rpe-gisteren" },
  "migreer-16-weken": { pad: "/api/admin/migreer-16-weken" },
  "regenereer-toekomstige-sessies": { pad: "/api/admin/regenereer-toekomstige-sessies", vereistUserId: true },
  "reset-en-regenereer": { pad: "/api/admin/reset-en-regenereer", vereistUserId: true },
  "test-volumecorrectie": {
    pad: "/api/admin/test-volumecorrectie", vereistUserId: true, headers: () => ({}),
    body: ({ userId }) => ({ secret: process.env.CRON_SECRET, userId }),
  },
  "sprint-staartje-activeer": {
    pad: "/api/admin/sprint-staartje-activeer", vereistUserId: true, vereistDatum: true,
    headers: CRON_SECRET_HEADERS,
  },
};

export async function POST(request) {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { actie, userId, datum } = await request.json().catch(() => ({}));
  const config = ACTIES[actie];
  if (!config) return NextResponse.json({ error: `Onbekende actie "${actie}"` }, { status: 400 });
  if (config.vereistUserId && !userId) return NextResponse.json({ error: "userId vereist" }, { status: 400 });
  if (config.vereistDatum && !datum) return NextResponse.json({ error: "datum vereist" }, { status: 400 });

  const headers = { "Content-Type": "application/json", ...(config.headers ? config.headers() : ADMIN_SECRET_HEADERS()) };
  const body = config.body
    ? config.body({ userId, datum })
    : (config.vereistUserId || config.vereistDatum ? { userId, datum } : undefined);

  const upstream = await fetch(new URL(config.pad, request.url), {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await upstream.json().catch(() => ({ error: "Ongeldig antwoord van upstream-route" }));
  return NextResponse.json(data, { status: upstream.status });
}

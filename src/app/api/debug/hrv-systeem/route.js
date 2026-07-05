import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getIntervalsCredentials } from "@/lib/users";
import { intervalsGet } from "@/lib/intervals";
import { getKV } from "@/lib/kv";
import { datumISO } from "@/lib/datum";
import { bepaalHrvZone, bepaalGecombineerdeZone } from "@/lib/hrv/zone";
import { bepaalNotificatie } from "@/lib/hrv/notificatie";
import { getHerstelDagen } from "@/lib/hrv/herstelsnelheid";

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export async function GET(request) {
  const user = await getSessionUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId") || user.id;
  const kv = getKV();
  const vandaag = datumISO(new Date());

  // 1. HRV-profiel
  const hrvProfielRaw = await kv.get(`hrv-profiel:${userId}`);
  const hrvProfiel = typeof hrvProfielRaw === "string" ? JSON.parse(hrvProfielRaw) : hrvProfielRaw;

  // 2. Actuele wellness
  let huidigHrv = null;
  let wellness14d = [];
  try {
    const creds = await getIntervalsCredentials(userId);
    if (creds) {
      const wVandaag = await intervalsGet("/wellness", { oldest: vandaag, newest: vandaag }, creds);
      huidigHrv = wVandaag?.[0]?.hrv ?? null;
      const oldest14 = datumISO(new Date(Date.now() - 14 * 86400000));
      wellness14d = await intervalsGet("/wellness", { oldest: oldest14, newest: vandaag }, creds) || [];
    }
  } catch {}

  // 3. HRV-zone
  const hrvZone = hrvProfiel ? bepaalHrvZone(huidigHrv, hrvProfiel) : "onbekend";

  // 4. Check-in
  const checkIn = await kv.get(`${userId}:checkin:${vandaag}`);
  const gecombineerdeZone = hrvProfiel
    ? bepaalGecombineerdeZone(hrvZone, checkIn?.score ?? null, hrvProfiel?.hrv_checkin_gewichten)
    : "onbekend";

  // 5. Seizoensplan: dag vandaag
  const plan = await kv.get(`${userId}:seizoensplan`);
  const sessieVandaag = plan?.weekSessies?.sessies?.find(s => s.datum === vandaag && !s.voltooid) || null;

  // 6. Notificatiebesluit
  const notificatieBesluit = bepaalNotificatie({
    hrvZone,
    geplandeSessie: sessieVandaag,
    checkInIngevuld: checkIn != null,
  });

  // 7. Observaties
  const observatiesRaw = await kv.get(`hrv-observaties:${userId}`);
  const observaties = Array.isArray(observatiesRaw) ? observatiesRaw : (typeof observatiesRaw === "string" ? JSON.parse(observatiesRaw) : []);
  const observatiesSamenvatting = {
    totaal: observaties.length,
    perKeuze: {
      schrappen: observaties.filter(o => o.keuze === "schrappen").length,
      verlichten: observaties.filter(o => o.keuze === "verlichten").length,
      verplaatsen: observaties.filter(o => o.keuze === "verplaatsen").length,
      origineel: observaties.filter(o => o.keuze === "origineel").length,
    },
    meestRecent: observaties.slice(-3).reverse(),
  };

  // 8. Notificatieteller
  const weeknummer = getISOWeek(new Date());
  const notificatieCount = parseInt(await kv.get(`hrv-notificaties:${userId}:${weeknummer}`) ?? "0");

  // 9. HRV-historie 14d
  const hrvHistorie = wellness14d.map(d => ({
    datum: d.id || d.datum,
    hrv: d.hrv ?? null,
    zone: hrvProfiel ? bepaalHrvZone(d.hrv, hrvProfiel) : "onbekend",
    afwijking_sd: hrvProfiel && d.hrv
      ? Math.round(((d.hrv - hrvProfiel.basislijn_28d) / hrvProfiel.sd_90d) * 10) / 10
      : null,
  }));

  // 10. Herstelsnelheid
  const herstelsnelheidTabel = hrvProfiel?.herstelsnelheid
    ? Object.entries(hrvProfiel.herstelsnelheid)
        .filter(([k]) => !k.startsWith("_"))
        .map(([sessietype, data]) => ({
          sessietype,
          dagen_gemeten: data.dagen,
          observaties: data.observaties,
          betrouwbaar: data.observaties >= 8,
          populatienorm: getHerstelDagen(sessietype, { herstelsnelheid: {} }),
        }))
        .sort((a, b) => b.observaties - a.observaties)
    : [];

  return NextResponse.json({
    meta: { gegenereerd_op: new Date().toISOString(), datum: vandaag, userId },

    hrv_profiel: {
      aanwezig: hrvProfiel != null,
      modus: hrvProfiel?.modus ?? null,
      betrouwbaar: hrvProfiel?.betrouwbaar ?? false,
      basislijn_28d: hrvProfiel?.basislijn_28d ?? null,
      sd_90d: hrvProfiel?.sd_90d ?? null,
      rood_drempel: hrvProfiel?.rood_drempel ?? null,
      geel_drempel: hrvProfiel?.geel_drempel ?? null,
      checkin_actief: hrvProfiel?.checkin_actief ?? null,
      data_onderbreking: hrvProfiel?.data_onderbreking ?? null,
      gepersonaliseerd: hrvProfiel?.hrv_checkin_gewichten?.gepersonaliseerd ?? false,
      hrv_rpe_correlatie: {
        coeff: hrvProfiel?.hrv_rpe_correlatie?.coeff ?? null,
        observaties: hrvProfiel?.hrv_rpe_correlatie?.observaties ?? 0,
        betrouwbaar: hrvProfiel?.hrv_rpe_correlatie?.betrouwbaar ?? false,
      },
      gewichten: hrvProfiel?.hrv_checkin_gewichten ?? null,
      laatst_berekend: hrvProfiel?.laatst_berekend ?? null,
    },

    vandaag: {
      hrv_waarde: huidigHrv,
      hrv_zone_puur: hrvZone,
      check_in_score: checkIn?.score ?? null,
      gecombineerde_zone: gecombineerdeZone,
      sessie: sessieVandaag ? {
        sessietype: sessieVandaag.intentie?.sessietype ?? sessieVandaag.type,
        hrv_keuze_gemaakt: sessieVandaag.hrv_keuze_gemaakt ?? false,
        hrv_keuze: sessieVandaag.hrv_keuze ?? null,
        hrv_override: sessieVandaag.hrv_override ?? false,
        hrv_zone: sessieVandaag.hrv_zone ?? null,
        mode: sessieVandaag.mode ?? "planned",
      } : null,
    },

    notificatie: {
      zou_sturen: notificatieBesluit.sturen,
      type: notificatieBesluit.type,
      reden: notificatieBesluit.reden,
      notificaties_deze_week: notificatieCount,
      limiet: 3,
      limiet_bereikt: notificatieCount >= 3,
    },

    leerlaag: {
      observaties: observatiesSamenvatting,
      gewichtsherberekening_mogelijk: observaties.length >= 50,
      gewichtsherberekening_gedaan: hrvProfiel?.hrv_checkin_gewichten?.gepersonaliseerd ?? false,
    },

    herstelsnelheid: {
      tabel: herstelsnelheidTabel,
      categorieen_met_eigen_data: herstelsnelheidTabel.filter(r => r.betrouwbaar).length,
      categorieen_op_norm: herstelsnelheidTabel.filter(r => !r.betrouwbaar).length,
    },

    hrv_historie_14d: hrvHistorie,

    balansscore: {
      verwacht: { tsb: 0.40, hrv: 0.25, checkIn: 0.35, rhr: 0 },
      rhr_actief: false,
    },

    checks: {
      hrv_profiel_aanwezig: hrvProfiel != null,
      hrv_profiel_betrouwbaar: hrvProfiel?.betrouwbaar ?? false,
      modus_persoonlijk: hrvProfiel?.modus === "persoonlijk",
      rpe_correlatie_betrouwbaar: hrvProfiel?.hrv_rpe_correlatie?.betrouwbaar ?? false,
      zone_bepaald: hrvZone !== "onbekend",
      notificatielogica_werkt: notificatieBesluit.reden != null,
      observaties_aanwezig: observaties.length > 0,
      rhr_niet_meer_actief: true,
    },
  });
}

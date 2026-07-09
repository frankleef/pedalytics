// Elke plek die een seizoensplan terugschrijft na het lang vasthouden van een
// eerder-gelezen kopie (cron-runs die meerdere sequentiële externe aanroepen
// doen, achtergrondtaken) haalt via deze helper vlak vóór het schrijven een
// verse kopie op en past alleen zijn eigen specifieke mutatie daarop toe —
// i.p.v. een lang vastgehouden planvariabele blind terug te zetten, wat een
// lost-update-race zou veroorzaken met een gelijktijdige wijziging elders
// (bv. de gebruiker die zelf beschikbaarheid opslaat via /api/plan PUT).
// Geëxtraheerd uit cron/sync/route.js (was daar module-privé) zodat andere
// achtergrondprocessen (cron/morning, afwezigheidsperiodes) 'm ook kunnen
// gebruiken zonder de logica te dupliceren.
export async function bijwerkPlanVeilig(kv, planKey, muteer) {
  const versPlan = await kv.get(planKey);
  if (!versPlan) return null;
  muteer(versPlan);
  await kv.set(planKey, versPlan);
  return versPlan;
}

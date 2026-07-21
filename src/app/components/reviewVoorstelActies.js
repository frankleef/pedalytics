// Pure fetch-/actielogica voor ReviewVoorstelKaart.js, in een eigen
// JSX-vrij bestand — zelfde precedent als archetypeAdmin.js naast
// ArchetypeBuilder.js: dit project heeft geen jsdom/@testing-library/react
// (vitest.config.js draait environment: 'node') en esbuild/Vite kan een .js-
// bestand met JSX-syntax niet transformeren voor een test-import ("Failed to
// parse source... make sure to name the file .jsx/.tsx"). Door deze logica
// hier te isoleren blijft ze rechtstreeks testbaar met een gemockte
// global.fetch, zonder wijziging aan vitest.config.js.

export async function haalReviewVoorstellenOp() {
  const resp = await fetch("/api/plan/review-voorstel");
  const data = await resp.json();
  return data.success ? (data.data || []) : [];
}

export async function reageerOpVoorstel(item, actie) {
  const resp = await fetch("/api/plan/review-voorstel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datum: item.datum, actie, nieuwSessietype: item.nieuwSessietype }),
  });
  return resp.json();
}

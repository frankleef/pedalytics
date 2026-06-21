// Vaste voorbeeld-dataset voor gebruikers zonder intervals.icu-koppeling.
// Fictieve renner, compleet seizoensplan, ingevulde trends.
// Wordt NOOIT naar KV geschreven — alleen in-memory voor de UI.

export const demoProfiel = {
  ftp: 245, lt_hr: 172, max_hr: 195, gewicht: 78,
  hrv_basislijn: 52, hr_basislijn: 51, resting_hr: 51,
};

export const demoSeizoensplan = {
  doel: "ftp_verhogen", doel_label: "FTP verhogen", doel_icon: "⚡",
  tijdshorizon_weken: 12, huidige_ftp: 245, huidige_ctl: 42,
  startdatum: "2026-05-26", gestart: true,
  beschikbaarheid: { Dinsdag: true, Donderdag: true, Zaterdag: true },
  urenPerDag: { Dinsdag: 1.5, Donderdag: 1.5, Zaterdag: 2.5 },
  streefwaarde: "265-275W",
  samenvatting: "Geleidelijke opbouw met nadruk op sweetspot en drempelwerk, richting een FTP van 270W.",
  kader: [
    { week: 1, fase: "basis", tss_doel: 240, focus: "Z2 volume + sweetspot intro" },
    { week: 2, fase: "basis", tss_doel: 250, focus: "Z2 volume + sweetspot intro" },
    { week: 3, fase: "basis", tss_doel: 260, focus: "Z2 volume + sweetspot intro" },
    { week: 4, fase: "test", tss_doel: 180, focus: "Herstelweek + FTP-test" },
    { week: 5, fase: "sweetspot", tss_doel: 280, focus: "Sweetspot blokken (88-93% FTP)" },
    { week: 6, fase: "sweetspot", tss_doel: 290, focus: "Sweetspot blokken (88-93% FTP)" },
    { week: 7, fase: "sweetspot", tss_doel: 300, focus: "Sweetspot blokken (88-93% FTP)" },
    { week: 8, fase: "test", tss_doel: 190, focus: "Herstelweek + FTP-test" },
    { week: 9, fase: "drempel", tss_doel: 310, focus: "Drempel intervals (95-105% FTP)" },
    { week: 10, fase: "drempel", tss_doel: 320, focus: "Drempel intervals (95-105% FTP)" },
    { week: 11, fase: "consolidatie", tss_doel: 280, focus: "Drempel vasthouden, herstel" },
    { week: 12, fase: "test", tss_doel: 200, focus: "Herstelweek + FTP-test" },
  ],
  weekSessies: {
    weekdoel: "Aerobe basis opbouwen",
    sessies: [
      { datum: "2026-06-24", dag: "Dinsdag", type: "duur_lang", titel: "Z2 duurrit", tss: 75, duur_min: 90, vermogen: "170-185W", reden: "Aerobe basis", segmenten: [{ type: "z2", duur_min: 90, vermogenMin: 68, vermogenMax: 76, label: "Z2 duur" }] },
      { datum: "2026-06-26", dag: "Donderdag", type: "sweetspot", titel: "Sweet spot blokken", tss: 85, duur_min: 75, vermogen: "215-228W", reden: "Drempelvermogen ontwikkelen", segmenten: [{ type: "sweetspot", duur_min: 8, vermogenMin: 88, vermogenMax: 93, label: "Sweet spot" }, { type: "herstel", duur_min: 3, vermogenMin: 50, vermogenMax: 60, label: "Herstel" }, { type: "sweetspot", duur_min: 8, vermogenMin: 88, vermogenMax: 93, label: "Sweet spot" }, { type: "herstel", duur_min: 3, vermogenMin: 50, vermogenMax: 60, label: "Herstel" }, { type: "sweetspot", duur_min: 8, vermogenMin: 88, vermogenMax: 93, label: "Sweet spot" }, { type: "herstel", duur_min: 3, vermogenMin: 50, vermogenMax: 60, label: "Herstel" }] },
      { datum: "2026-06-28", dag: "Zaterdag", type: "duur_variabel", titel: "Variabele duurrit", tss: 110, duur_min: 150, vermogen: "170-210W", reden: "Volume + variatie", segmenten: [{ type: "z2", duur_min: 30, vermogenMin: 68, vermogenMax: 76, label: "Z2" }, { type: "tempo", duur_min: 10, vermogenMin: 76, vermogenMax: 85, label: "Tempo" }, { type: "z2", duur_min: 30, vermogenMin: 68, vermogenMax: 76, label: "Z2" }, { type: "tempo", duur_min: 10, vermogenMin: 76, vermogenMax: 85, label: "Tempo" }, { type: "z2", duur_min: 40, vermogenMin: 68, vermogenMax: 76, label: "Z2" }] },
    ],
  },
};

export const demoWellness = Array.from({ length: 28 }, (_, i) => {
  const d = new Date("2026-05-25"); d.setDate(d.getDate() + i);
  const base = 42 + i * 0.4;
  return {
    id: d.toISOString(), ctl: Math.round(base), atl: Math.round(base + Math.sin(i) * 5),
    restingHR: 51 + Math.round(Math.sin(i * 0.5) * 3),
    hrv: 52 + Math.round(Math.cos(i * 0.3) * 6),
    sleepScore: 65 + Math.round(Math.random() * 25),
  };
});

export const demoRitten = [
  { id: "demo1", naam: "Ochtendrit Z2", datum_iso: "2026-06-17", duur_min: 92, wattage: 178, np: 178, hartslag: 142, tss: 72, max_watt: 580, solo: true },
  { id: "demo2", naam: "Sweet spot training", datum_iso: "2026-06-19", duur_min: 78, wattage: 205, np: 212, hartslag: 158, tss: 88, max_watt: 620, solo: true },
  { id: "demo3", naam: "Lange duurrit", datum_iso: "2026-06-21", duur_min: 148, wattage: 172, np: 175, hartslag: 138, tss: 105, max_watt: 550, solo: true },
];

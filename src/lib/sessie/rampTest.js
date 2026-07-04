// Sectie 51-B: vaste-structuur-generator voor de ramp-test (Zwift-standaard,
// geschikt voor FTP >175W). Geen archetype, geen duur_pct-schaling — het
// protocol is vast, de sessieduur is per definitie variabel (eindigt bij
// uitputting, niet bij een blok-teller). FTP wordt niet door Kesto
// berekend maar door intervals.icu (icu_ftp) na afloop verwerkt (ftpUpdate.js).

/**
 * Genereert de vaste ramp-test-protocolstructuur.
 * Puur, synchroon, geen I/O.
 */
export function genereerRampTestSessie() {
  return {
    sessietype: 'ramp_test',
    archetype_id: null,
    gegenereerd_door: 'vast_protocol',
    protocol: {
      warmup: { duur_min: 5, omschrijving: 'Vrij tempo, rustig opbouwend (Z1–Z2)' },
      ramp: {
        start_watt: 100,
        increment_watt_per_min: 20,
        omschrijving: 'Elke minuut +20W, blijf zitten, ga door tot je het niet meer volhoudt',
      },
      cooldown: { duur_min: 5, omschrijving: 'Rustig uittrappen (Z1)' },
    },
    duur_min_geschat: 25,   // indicatief voor UI, niet hard (5 + ~15 + 5)
    tss_doel: null,          // niet vooraf bepaalbaar — variabele einduur
    verwacht_rpe: 9,         // vast — een ramp test naar uitputting is per definitie maximaal
  };
}

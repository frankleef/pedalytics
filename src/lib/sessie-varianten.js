// Volledige variantenstructuur voor alle archetypes
// duur_pct = fractie van totale sessieduur (som per variant = 1.0)
// pct_ftp = exact % van FTP (optioneel, anders gebruikt berekenBlok zone+positie)
// cadans_rpm = cadanstarget (alleen kracht_lage_cadans)

export const SESSIE_ARCHETYPES = {

  // ─── CATEGORIE 1: Z2 DUUR ───────────────────────────────────────────────

  z2_duur: [
    {
      id: 'z2_progressief',
      naam: 'Progressief',
      tss_range: [55, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_prog_3blokken',
          zwaartegewicht: 2,
          naam: '3 blokken',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.333 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.333 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.334 },
          ]
        },
        {
          id: 'z2_prog_6blokken',
          zwaartegewicht: 3,
          naam: '6 blokken gradueel',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 61, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 67, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 69, duur_pct: 0.166 },
            { type: 'werk', zone: 'Z2', pct_ftp: 71, duur_pct: 0.166 },
          ]
        },
        {
          id: 'z2_prog_2plus',
          zwaartegewicht: 1,
          naam: 'Rustig + progressief',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.50 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.25 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.25 },
          ]
        },
      ]
    },

    {
      id: 'z2_negatief_split',
      naam: 'Negatieve splits',
      tss_range: [55, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_ns_2blokken',
          zwaartegewicht: 1,
          naam: '2 blokken',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.50 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.50 },
          ]
        },
        {
          id: 'z2_ns_4blokken',
          zwaartegewicht: 2,
          naam: '4 blokken oplopend',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.25 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.25 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.25 },
            { type: 'werk', zone: 'Z2', pct_ftp: 71, duur_pct: 0.25 },
          ]
        },
        {
          id: 'z2_ns_6blokken',
          zwaartegewicht: 3,
          naam: '6 blokken gradueel',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 61, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 67, duur_pct: 0.167 },
            { type: 'werk', zone: 'Z2', pct_ftp: 69, duur_pct: 0.166 },
            { type: 'werk', zone: 'Z2', pct_ftp: 71, duur_pct: 0.166 },
          ]
        },
      ]
    },

    {
      id: 'z2_variabel_blokken',
      naam: 'Variabele blokken',
      tss_range: [60, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_var_15_10',
          zwaartegewicht: 1,
          naam: '15\'/10\' patroon',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.60 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.40 },
          ]
        },
        {
          id: 'z2_var_20_8',
          zwaartegewicht: 2,
          naam: '20\'/8\' patroon',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.071 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.071 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.071 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.071 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
          ]
        },
        {
          id: 'z2_var_12_6',
          zwaartegewicht: 3,
          naam: '12\'/6\' patroon (meer afwisseling)',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.20 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.10 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.20 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.10 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.20 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.10 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.10 },
          ]
        },
      ]
    },

    {
      id: 'z2_golf',
      naam: 'Golfpatroon',
      tss_range: [60, 95],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_golf_8_5',
          zwaartegewicht: 2,
          naam: '8\'/5\' golf (4 cycli)',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.123 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.077 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.123 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.077 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.123 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.077 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.123 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.077 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.120 },
          ]
        },
        {
          id: 'z2_golf_10_4',
          zwaartegewicht: 1,
          naam: '10\'/4\' golf (3 cycli)',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.057 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.057 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.143 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.057 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.200 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.200 },
          ]
        },
        {
          id: 'z2_golf_6_3',
          zwaartegewicht: 3,
          naam: '6\'/3\' golf (6 cycli)',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk', zone: 'Z2', pct_ftp: 70, duur_pct: 0.100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
          ]
        },
      ]
    },

    {
      id: 'z2_cadans',
      naam: 'Cadansvariatie',
      tss_range: [55, 90],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_cad_8_4',
          zwaartegewicht: 2,
          naam: '8\'/4\' cadans',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.167, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.083, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.167, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.083, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.167, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.083, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.167, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.083, cadans_rpm: 75  },
          ]
        },
        {
          id: 'z2_cad_10_5',
          zwaartegewicht: 1,
          naam: '10\'/5\' cadans',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.222, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.111, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.222, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.111, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.222, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.112, cadans_rpm: 75  },
          ]
        },
        {
          id: 'z2_cad_6_3',
          zwaartegewicht: 3,
          naam: '6\'/3\' cadans (snelle wisseling)',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.125, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.063, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.125, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.063, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.125, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.063, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.125, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.063, cadans_rpm: 75  },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.125, cadans_rpm: 100 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.063, cadans_rpm: 75  },
          ]
        },
      ]
    },

    {
      id: 'z2_tempo_blokken',
      naam: 'Z2 met temposnippers',
      tss_range: [70, 105],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      week_in_fase_min: 3,
      toegestaan_in_herstelweek: false,
      varianten: [
        {
          id: 'z2_tempo_3x7',
          zwaartegewicht: 1,
          naam: '3× 7\' Z3',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.117 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.117 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.117 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.124 },
          ]
        },
        {
          id: 'z2_tempo_4x5',
          zwaartegewicht: 2,
          naam: '4× 5\' Z3',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.150 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.083 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.150 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.083 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.150 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.083 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.150 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80, duur_pct: 0.083 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.068 },
          ]
        },
        {
          id: 'z2_tempo_2x10',
          zwaartegewicht: 3,
          naam: '2× 10\' Z3',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.250 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 82, duur_pct: 0.167 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.250 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 82, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.166 },
          ]
        },
      ]
    },

    {
      id: 'z2_heuvel',
      naam: 'Heuvelsimulatie',
      tss_range: [60, 95],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max', 'taper'],
      varianten: [
        {
          id: 'z2_heuvel_licht',
          zwaartegewicht: 1,
          naam: '6× [6\'/5\'] licht',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 68, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.076 },
          ]
        },
        {
          id: 'z2_heuvel_standaard',
          zwaartegewicht: 2,
          naam: '6× [6\'/5\'] standaard',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 72, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.076 },
          ]
        },
        {
          id: 'z2_heuvel_zwaar',
          zwaartegewicht: 3,
          naam: '6× [6\'/5\'] zwaar',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
            { type: 'werk', zone: 'Z2', pct_ftp: 76, duur_pct: 0.091 },
            { type: 'werk', zone: 'Z2', pct_ftp: 65, duur_pct: 0.076 },
          ]
        },
      ]
    },

    {
      id: 'z2_tempo_teugjes',
      naam: 'Tempo-teugjes',
      tss_range: [65, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      vereist_lage_decoupling: true,
      toegestaan_in_herstelweek: false,
      varianten: [
        {
          id: 'z2_teugjes_licht',
          zwaartegewicht: 1,
          naam: '4× [10\'/8\'] licht',
          blokken: [
            { type: 'werk', zone: 'Z3', pct_ftp: 78, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 78, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 78, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 78, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 60, duur_pct: 0.111 },
          ]
        },
        {
          id: 'z2_teugjes_standaard',
          zwaartegewicht: 2,
          naam: '4× [10\'/8\'] standaard',
          blokken: [
            { type: 'werk', zone: 'Z3', pct_ftp: 80, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 80, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 80, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 80, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 62, duur_pct: 0.111 },
          ]
        },
        {
          id: 'z2_teugjes_zwaar',
          zwaartegewicht: 3,
          naam: '4× [10\'/8\'] zwaar',
          blokken: [
            { type: 'werk', zone: 'Z3', pct_ftp: 82, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 82, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 82, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.111 },
            { type: 'werk', zone: 'Z3', pct_ftp: 82, duur_pct: 0.139 },
            { type: 'werk', zone: 'Z2', pct_ftp: 64, duur_pct: 0.111 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 2: SWEETSPOT ──────────────────────────────────────────────

  sweetspot_intervallen: [
    {
      // Bovengrens 95->105 opgehoogd: ss_sprint_finish/ss_cadans_hoog
      // berekenen op 100-103 TSS @90min (zelfstandig gekalibreerd, zie hun
      // blokken hieronder). De onderliggende som-afwijking van het bestaande
      // ss_std_3x20 (som=1.068, TSS 100 @90min, onderdeel van de 27
      // vervolgticket-mismatches) is HIER niet aangepakt — alleen de
      // archetype-brede tss_range is verruimd voor de nieuwe varianten.
      id: 'ss_standaard',
      naam: 'Sweetspot standaard',
      tss_range: [70, 105],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'ss_std_3x15',
          zwaartegewicht: 1,
          naam: '3× 15\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.225, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.075, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.100 },
          ]
        },
        {
          id: 'ss_std_3x20',
          zwaartegewicht: 2,
          naam: '3× 20\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.267, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.067, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.066 },
          ]
        },
        {
          id: 'ss_std_2x25',
          zwaartegewicht: 3,
          naam: '2× 25\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.357, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.107, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.072 },
          ]
        },
        {
          // Coach-praktijk, lage extra fysiologische last. Bewust NIET
          // ss_std_3x20's duur_pct hergebruikt (som=1.068, zie vervolgticket-
          // notitie) — hier zelfstandig gekalibreerd op een 3×20'-kern met
          // som≈1.0, plus een korte Z7-sprint direct vóór elk herstelblok.
          id: 'ss_sprint_finish',
          zwaartegewicht: 2,
          naam: '3× 20\' + sprint-finish',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90,  duur_pct: 0.250,    reps: 3 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.002222, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.063,    reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055 },
          ]
        },
        {
          // Praktijkbron, geen RCT. Zelfde 3×20'-kern als ss_sprint_finish
          // (zelfstandig gekalibreerd, som≈1.0), met cadans_rpm-override op de
          // werkblokken i.p.v. zelfgekozen cadans.
          id: 'ss_cadans_hoog',
          zwaartegewicht: 2,
          naam: '3× 20\' hoge cadans',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.250, reps: 3, cadans_rpm: { min: 90, max: 110 } },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.063, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.062 },
          ]
        },
      ]
    },

    {
      id: 'ss_oplopend',
      naam: 'Sweetspot oplopend',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'ss_opl_4x12',
          zwaartegewicht: 1,
          naam: '4× 12\' (85→91%)',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 85, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 87, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 89, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 91, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.164 },
          ]
        },
        {
          id: 'ss_opl_3x15',
          zwaartegewicht: 2,
          naam: '3× 15\' (85→91%)',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 85, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.075 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.075 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 91, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.175 },
          ]
        },
        {
          id: 'ss_opl_5x10',
          zwaartegewicht: 3,
          naam: '5× 10\' (84→92%)',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 84, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 86, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 90, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 92, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.207 },
          ]
        },
      ]
    },

    {
      id: 'ss_afdalend',
      naam: 'Sweetspot afdalend',
      tss_range: [70, 95],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'ss_afd_4x12',
          zwaartegewicht: 2,
          naam: '4× 12\' (93→87%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 93, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 91, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 89, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.056 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 87, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.164 },
          ]
        },
        {
          id: 'ss_afd_3x15',
          zwaartegewicht: 3,
          naam: '3× 15\' (93→87%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 93, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.075 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.075 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 87, duur_pct: 0.225 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.175 },
          ]
        },
        {
          id: 'ss_afd_5x10',
          zwaartegewicht: 1,
          naam: '5× 10\' (94→86%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 94, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 92, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.042 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 86, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.207 },
          ]
        },
      ]
    },

    {
      // Piramidevorm qua bloktijd EN intensiteit (5-10-15-10-5 min-ratio,
      // 88→90→93→90→88% FTP) — aanvulling naast ss_oplopend (monotoon
      // oplopend) en ss_afdalend (monotoon aflopend), veelgebruikt op
      // ROUVY/TrainerRoad. Gebouwd met dezelfde duur_pct-proportionele
      // techniek als die twee siblings (expliciete opeenvolgende paren i.p.v.
      // reps-groepering, want de intensiteit varieert per blok) — GEEN
      // duur_sec_vast: een eerdere versie met vaste ladderminuten (net als
      // vo2_afbouwend) bleek 3 bestaande invarianten te breken (10%-duur-
      // afwijkingstest, archetype-maximum-test bij 4 uur, en
      // berekenZ2AandeelSessietype die duur_sec_vast niet herkent — zie
      // vervolgticket-notitie). Met duur_pct schaalt de piramide gewoon mee,
      // net als ss_oplopend/afdalend, en gelden de normale cap/vloer-regels.
      // Vereist wel een eigen entry in MAXIMUM_BLOKDUUR_PER_ARCHETYPE
      // (sessie-generatie.js) — anders zou de generieke Z4-cap (480s) het
      // piek-blok inkorten.
      id: 'ss_piramide',
      naam: 'Sweetspot piramide',
      tss_range: [48, 119],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'ss_pir_5_10_15_10_5',
          zwaartegewicht: 2,
          naam: '5-10-15-10-5\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.077778 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.05 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.155556 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.05 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 93, duur_pct: 0.233333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.05 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.155556 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.05 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.077778 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.1 },
          ]
        },
      ]
    },

    {
      id: 'ss_lang',
      naam: 'Lang sweetspot blok',
      tss_range: [75, 105],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'ss_lang_1x35',
          zwaartegewicht: 3,
          naam: '1× 35\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.583 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.417 },
          ]
        },
        {
          id: 'ss_lang_2x25',
          zwaartegewicht: 2,
          naam: '2× 25\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.357, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.100, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.086 },
          ]
        },
        {
          id: 'ss_lang_30plus20',
          zwaartegewicht: 1,
          naam: '30\' + 20\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 89, duur_pct: 0.400 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.133 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 91, duur_pct: 0.267 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.200 },
          ]
        },
      ]
    },

    {
      id: 'ss_kort_veel',
      naam: 'Veel korte sweetspotblokken',
      tss_range: [70, 100],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'ss_kv_6x8',
          zwaartegewicht: 1,
          naam: '6× 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.143, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.048, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.142 },
          ]
        },
        {
          id: 'ss_kv_8x6',
          zwaartegewicht: 2,
          naam: '8× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 91, duur_pct: 0.107, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.036, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.144 },
          ]
        },
        {
          id: 'ss_kv_10x5',
          zwaartegewicht: 3,
          naam: '10× 5\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.083, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.033, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.170 },
          ]
        },
      ]
    },

    {
      id: 'tempo_continu',
      naam: 'Tempo continu',
      tss_range: [60, 90],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'tc_1blok',
          zwaartegewicht: 1,
          naam: '1 lang blok',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 82, duur_pct: 0.667 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.333 },
          ]
        },
        {
          id: 'tc_2blok',
          zwaartegewicht: 2,
          naam: '2 blokken met pauze',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 82, duur_pct: 0.333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.083 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 83, duur_pct: 0.333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.251 },
          ]
        },
        {
          id: 'tc_oplopend',
          zwaartegewicht: 3,
          naam: 'Oplopend tempo (76→85%)',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 76, duur_pct: 0.167 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 79, duur_pct: 0.167 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 82, duur_pct: 0.167 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 85, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.332 },
          ]
        },
      ]
    },

    {
      id: 'tempo_intervallen',
      naam: 'Tempo intervallen',
      tss_range: [65, 90],
      fase_beschikbaar: ['sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'ti_4x12',
          zwaartegewicht: 2,
          naam: '4× 12\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 83, duur_pct: 0.171, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.057, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.072 },
          ]
        },
        {
          id: 'ti_5x10',
          zwaartegewicht: 1,
          naam: '5× 10\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 83, duur_pct: 0.143, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.048, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.095 },
          ]
        },
        {
          id: 'ti_3x15',
          zwaartegewicht: 3,
          naam: '3× 15\'',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 84, duur_pct: 0.214, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.071, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.143 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 3: KRACHT ─────────────────────────────────────────────────

  kracht_lage_cadans: [
    {
      id: 'kracht_standaard',
      naam: 'Kracht standaard',
      tss_range: [55, 75],
      fase_beschikbaar: ['basis','sweetspot','drempel'],
      doel_beperking: ['klimmen','ftp','sprint'],
      varianten: [
        {
          id: 'kracht_std_4x5',
          zwaartegewicht: 1,
          naam: '4× 5\' @ 50 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.133, cadans_rpm: 50, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.268 },
          ]
        },
        {
          id: 'kracht_std_5x4',
          zwaartegewicht: 2,
          naam: '5× 4\' @ 52 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.111, cadans_rpm: 52, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.044, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.225 },
          ]
        },
        {
          id: 'kracht_std_prog',
          zwaartegewicht: 3,
          naam: '4× 5\' progressief (88→95%)',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.133, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.133, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 93, duur_pct: 0.133, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 95, duur_pct: 0.133, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.318 },
          ]
        },
      ]
    },

    {
      id: 'kracht_lang',
      naam: 'Kracht lang',
      tss_range: [65, 85],
      fase_beschikbaar: ['basis','sweetspot','drempel'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen','ftp','sprint'],
      varianten: [
        {
          id: 'kracht_lang_4x7',
          zwaartegewicht: 1,
          naam: '4× 7\' @ 50 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.175, cadans_rpm: 50, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.100 },
          ]
        },
        {
          id: 'kracht_lang_3x8',
          zwaartegewicht: 2,
          naam: '3× 8\' @ 52 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.200, cadans_rpm: 52, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.067, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.199 },
          ]
        },
        {
          id: 'kracht_lang_afd',
          zwaartegewicht: 3,
          naam: '4× 7\' afdalend (95→88%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 95, duur_pct: 0.175, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 92, duur_pct: 0.175, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90, duur_pct: 0.175, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.175, cadans_rpm: 50 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.150 },
          ]
        },
      ]
    },

    {
      // Hebisz & Hebisz 2024 (PLOS ONE) — 8,7% VO2max-winst bij lage cadans
      // (40-60 rpm) vs 4,6% bij vrije cadans, zelfde arbeid. RPE 7/10 uit het
      // Wakefield/Bora-protocol vertaald naar 85-92% FTP @ 40-60 rpm (akkoord
      // vooraf, zie chunk 0-rapportage). Eigen archetype i.p.v. toevoeging aan
      // kracht_standaard/kracht_lang: bewaart het RCT-onderscheid t.o.v. die
      // twee (geen evidence-citaat in hun bestaande data). cadans_rpm als
      // {min,max}-object i.p.v. de bestaande enkel-getal-conventie (50/52 rpm)
      // — de bron geeft hier expliciet een bandbreedte, geen vast getal.
      // Cadans-opbouw (hoger beginnen, in 2-4 weken zakken naar 45-50 rpm) is
      // een instructie voor de sessie-notes, niet iets de generator hoeft te
      // plannen — buiten scope van deze blokken-structuur.
      id: 'kracht_torque',
      naam: 'Kracht torque (lage cadans, RCT)',
      tss_range: [33, 98],
      fase_beschikbaar: ['basis', 'sweetspot', 'drempel'],
      doel_beperking: ['klimmen', 'ftp', 'sprint'],
      varianten: [
        {
          id: 'kracht_torque_kort',
          zwaartegewicht: 1,
          naam: '3× 4\' @ 45-55 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88, duur_pct: 0.044444, cadans_rpm: { min: 45, max: 55 }, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.044444, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.733333 },
          ]
        },
        {
          id: 'kracht_torque_standaard',
          zwaartegewicht: 2,
          naam: '4× 4\' @ 40-55 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 89, duur_pct: 0.044444, cadans_rpm: { min: 40, max: 55 }, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.044444, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.644444 },
          ]
        },
        {
          id: 'kracht_torque_lang',
          zwaartegewicht: 3,
          naam: '3× 10\' @ 45-60 rpm',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 85, duur_pct: 0.111111, cadans_rpm: { min: 45, max: 60 }, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.055556, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.5 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 4: DREMPEL ────────────────────────────────────────────────

  drempel_intervallen: [
    {
      // Vervolgticket chunk 1 (losse gevallen): alle 3 varianten hadden het
      // rust-artefact (herstel-blok tussen reps 25-75% te lang t.o.v. de
      // gestelde "4 min Z2 herstel") — inclusief dr_std_2x20 (som=1.0 exact)
      // en dr_std_3x18 (som=0.999, wél in de 27-mismatchlijst maar niet in de
      // som-lijst), beide dus niet gevangen door de oorspronkelijke som-scan.
      id: 'drempel_standaard',
      naam: 'Drempel standaard',
      tss_range: [95, 107],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'dr_std_3x15',
          zwaartegewicht: 1,
          naam: '3× 15\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.166667, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.366667 },
          ]
        },
        {
          id: 'dr_std_2x20',
          zwaartegewicht: 3,
          naam: '2× 20\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.222222, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.466667 },
          ]
        },
        {
          id: 'dr_std_3x18',
          zwaartegewicht: 2,
          naam: '3× 18\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.2, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.266667 },
          ]
        },
      ]
    },

    {
      id: 'drempel_oplopend',
      naam: 'Drempel oplopend',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'dr_opl_3x12',
          zwaartegewicht: 1,
          naam: '3× 12\' (93→103%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 93,  duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 98,  duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.345 },
          ]
        },
        {
          id: 'dr_opl_4x10',
          zwaartegewicht: 2,
          naam: '4× 10\' (92→104%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 92,  duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 96,  duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 104, duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.257 },
          ]
        },
        {
          id: 'dr_opl_3x15',
          zwaartegewicht: 3,
          naam: '3× 15\' (93→103%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 93,  duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 98,  duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.216 },
          ]
        },
      ]
    },

    {
      id: 'drempel_afdalend',
      naam: 'Drempel afdalend',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'dr_afd_3x12',
          zwaartegewicht: 2,
          naam: '3× 12\' (103→93%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 98,  duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 93,  duur_pct: 0.171 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.345 },
          ]
        },
        {
          id: 'dr_afd_4x10',
          zwaartegewicht: 1,
          naam: '4× 10\' (104→92%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 104, duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 96,  duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 92,  duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.257 },
          ]
        },
        {
          id: 'dr_afd_3x15',
          zwaartegewicht: 3,
          naam: '3× 15\' (103→93%)',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 98,  duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 93,  duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.216 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 3: geen structurele fout — werkduur van alle 3
      // varianten matcht al exact hun naam (8'/6'/7'), rust wijkt slechts mild
      // af (2min i.p.v. 3min, zelfde orde als elders geaccepteerde varianten).
      // De oorspronkelijke TSS-mismatch was puur verouderde documentatie: alle
      // 3 varianten berekenen consistent op 107-108, ruim boven de oude
      // bovengrens van 100 — range hier bijgewerkt, blokken ongewijzigd.
      id: 'drempel_kort_veel',
      naam: 'Veel korte drempelblokken',
      tss_range: [107, 108],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'dr_kv_6x8',
          zwaartegewicht: 1,
          naam: '6× 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.107, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.036, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.118 },
          ]
        },
        {
          id: 'dr_kv_8x6',
          zwaartegewicht: 3,
          naam: '8× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.080, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.027, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.136 },
          ]
        },
        {
          id: 'dr_kv_7x7',
          zwaartegewicht: 2,
          naam: '7× 7\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.093, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.031, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.133 },
          ]
        },
      ]
    },

    {
      id: 'drempel_lang',
      naam: 'Lang drempelblok',
      tss_range: [80, 110],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'dr_lang_1x30',
          zwaartegewicht: 2,
          naam: '1× 30\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 97, duur_pct: 0.500 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.500 },
          ]
        },
        {
          id: 'dr_lang_1x35',
          zwaartegewicht: 3,
          naam: '1× 35\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 95, duur_pct: 0.583 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.417 },
          ]
        },
        {
          id: 'dr_lang_2x20',
          zwaartegewicht: 1,
          naam: '2× 20\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 97, duur_pct: 0.286, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.071, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.286 },
          ]
        },
      ]
    },

    {
      id: 'drempel_wisselend',
      naam: 'Drempel wisselend',
      tss_range: [80, 105],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'dr_wis_20plus8',
          zwaartegewicht: 2,
          naam: '20\' + 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 94,  duur_pct: 0.286 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 102, duur_pct: 0.114 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.529 },
          ]
        },
        {
          id: 'dr_wis_25plus10',
          zwaartegewicht: 3,
          naam: '25\' + 10\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 94,  duur_pct: 0.357 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 102, duur_pct: 0.143 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.429 },
          ]
        },
        {
          id: 'dr_wis_15plus8plus8',
          zwaartegewicht: 1,
          naam: '15\' + 8\' + 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 94,  duur_pct: 0.214 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 102, duur_pct: 0.114 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 102, duur_pct: 0.114 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.444 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1 (over-under-familie): alle 6 varianten in dit
      // en het ou_lang-archetype hadden dezelfde structurele bug — een extra
      // herstel(reps=N)-blok tussen elke under/over-cyclus, terwijl een
      // over-under per definitie continu doorfietst (onder direct door naar
      // boven, geen rust ertussen). Dit gold ook voor varianten wier som
      // toevallig binnen 2% van 1.0 viel (ou_std_8x90plus45: som=0.992) — de
      // som-metriek is dus geen betrouwbare indicator voor dit specifieke
      // probleem. Elke variant hieronder is onafhankelijk herkalibreerd op de
      // eigen naam (bv. "6×[2'+1']" -> 2 min onder/1 min boven, continu) met
      // een enkel afsluitend Z2-blok voor de rest van de sessieduur — zelfde
      // aanpak als ou_std_hardstart (vorig ticket).
      id: 'ou_standaard',
      naam: 'Over-unders',
      tss_range: [70, 77],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'ou_std_6x2plus1',
          zwaartegewicht: 2,
          naam: '6× [2\'+1\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.022222, reps: 6 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.011111, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.8 },
          ]
        },
        {
          id: 'ou_std_8x90plus45',
          zwaartegewicht: 1,
          naam: '8× [90"+45"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.016667, reps: 8 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.008333, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.8 },
          ]
        },
        {
          id: 'ou_std_5x2half',
          zwaartegewicht: 3,
          naam: '5× [2\'30"+75"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.027778, reps: 5 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.013889, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.791667 },
          ]
        },
        {
          // Coach-praktijk (EVOQ.BIKE), geen RCT.
          id: 'ou_std_hardstart',
          zwaartegewicht: 3,
          naam: 'Hard start + 6× [2\'+1\']',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.033333 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.022222, reps: 6 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.011111, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.766667 },
          ]
        },
      ]
    },

    {
      id: 'ou_lang',
      naam: 'Lange over-unders',
      tss_range: [73, 76],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'ou_lang_4x3plus2',
          zwaartegewicht: 2,
          naam: '4× [3\'+2\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.033333, reps: 4 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.022222, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.777778 },
          ]
        },
        {
          id: 'ou_lang_5x2half',
          zwaartegewicht: 1,
          naam: '5× [2\'30"+2\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.027778, reps: 5 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.022222, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.75 },
          ]
        },
        {
          id: 'ou_lang_3x4plus2half',
          zwaartegewicht: 3,
          naam: '3× [4\'+2\'30"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.044444, reps: 3 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.027778, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.783333 },
          ]
        },
      ]
    },

    {
      id: 'pyr_oplopend',
      naam: 'Pyramide oplopend',
      tss_range: [75, 95],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'pyr_opl_2_4_6',
          zwaartegewicht: 1,
          naam: '2\'–4\'–6\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.100 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.200 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.300 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.283 },
          ]
        },
        {
          id: 'pyr_opl_3_5_7',
          zwaartegewicht: 2,
          naam: '3\'–5\'–7\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.125 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.063 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.208 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.063 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.292 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.249 },
          ]
        },
        {
          id: 'pyr_opl_2_3_5_7',
          zwaartegewicht: 3,
          naam: '2\'–3\'–5\'–7\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.071 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.036 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.107 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.036 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.179 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.036 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.250 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.285 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1 (set-aside-vervolg): alle 3 varianten hadden
      // duur_pct-waarden die niet van echte doelminuten waren afgeleid — bij
      // pyr_vol_2_4_6_4_2/3_5_8_5_3 zo ernstig dat de archetype-cap (540s) de
      // 3 middelste rungs plat sloeg tot dezelfde waarde (bv. 4-8-8-8-4 i.p.v.
      // 2-4-6-4-2 min — de piek-vorm was volledig verdwenen). Na herkalibratie
      // op echte doelminuten blijft elke rung ruim onder de cap, dus geen
      // capping meer nodig en de piramidevorm blijft zichtbaar. pyr_vol_2x's
      // "2 min Z2 tussenin" was los daarvan te kort (1 min i.p.v. 2 min); geen
      // rust toegevoegd tussen de twee buitenste herhalingen (2× [...]) — dat
      // is intentioneel, de vorm loopt al af naar 2 min voor de herhaling.
      id: 'pyr_volledig',
      naam: 'Volledige pyramide',
      tss_range: [76, 93],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'pyr_vol_2_4_6_4_2',
          zwaartegewicht: 1,
          naam: '2\'–4\'–6\'–4\'–2\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.066667 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.711111 },
          ]
        },
        {
          id: 'pyr_vol_3_5_8_5_3',
          zwaartegewicht: 2,
          naam: '3\'–5\'–8\'–5\'–3\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.055556 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.088889 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.055556 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.644444 },
          ]
        },
        {
          id: 'pyr_vol_2x',
          zwaartegewicht: 3,
          naam: '2× [2\'–4\'–6\'–4\'–2\']',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.022222, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.044444, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.066667, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.044444, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.022222, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.422222 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 5: VO2MAX ─────────────────────────────────────────────────

  vo2max_intervallen: [
    {
      // Vervolgticket chunk 1 (vo2-familie): vo2_5x5_std en vo2_4x6 hadden
      // hetzelfde soort rust-artefact als de over-under-familie (herstel-
      // blok tussen reps disproportioneel lang t.o.v. de naam) — onafhankelijk
      // herkalibreerd op de eigen naam. vo2_6x4 is BEWUST NIET aangepast: die
      // heeft een andere fout (werkduur zelf onjuist: levert 6 min i.p.v. de
      // genoemde 4 min) — inmiddels ook gefixt (zie hieronder): werkduur
      // herkalibreerd naar de daadwerkelijke 4 min i.p.v. de eerder geleverde
      // 6 min.
      id: 'vo2_5x5',
      naam: 'Klassieke 5×5',
      tss_range: [85, 93],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'vo2_5x5_std',
          zwaartegewicht: 2,
          naam: '5× 5\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.055556, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.444444 },
          ]
        },
        {
          id: 'vo2_6x4',
          zwaartegewicht: 3,
          naam: '6× 4\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.044444, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.4 },
          ]
        },
        {
          id: 'vo2_4x6',
          zwaartegewicht: 1,
          naam: '4× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 108, duur_pct: 0.066667, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.511111 },
          ]
        },
      ]
    },

    {
      id: 'vo2_4x4',
      naam: 'Rønnestad 4×4',
      tss_range: [84, 88],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'vo2_4x4_std',
          zwaartegewicht: 2,
          naam: '4× 4\' @ 115%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.044444, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.644444 },
          ]
        },
        {
          id: 'vo2_5x4',
          zwaartegewicht: 1,
          naam: '5× 4\' @ 112%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.044444, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.555556 },
          ]
        },
        {
          id: 'vo2_4x4_hard',
          zwaartegewicht: 3,
          naam: '4× 4\' @ 118%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.044444, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.644444 },
          ]
        },
      ]
    },

    {
      // Was voorheen inconsistent: metadata beschreef "3 sets × 20 reps" (60
      // herhalingen), maar het codeblok had maar 1 set van 20 reps zonder
      // buitenste sets-loop — en zelfs die 1-set-versie rekende zich stuk:
      // duur_pct was gekalibreerd op ~119s werk per rep i.p.v. de bedoelde 40s
      // (pas de archetype-cap van 60s in MAXIMUM_BLOKDUUR_PER_ARCHETYPE hield
      // het enigszins in toom, maar zelfs gecapt bleef het 60s i.p.v. 40s).
      // Hieronder zijn de duur_pct-waarden teruggerekend op de 40s/20s-target
      // zelf (bij de standaard-testduur van 90 min, zie DEFAULT_TESTDUUR_MIN
      // in /api/admin/archetypes/preview) i.p.v. losstaand geschat. Dit is de
      // duur VÓÓR de centrale warming-up-injectie (46-A, voegWarmingUpToe) —
      // die krimpt elk niet-vast blok in elk archetype met dezelfde ratio om
      // ruimte te maken voor de opwarming, dus de uiteindelijke sessie toont
      // hier ~35s/17.5s (bij 90 min). Dat is bewust niet gecompenseerd: geen
      // ander archetype in dit bestand compenseert voor die krimp, dus 40s als
      // brontarget met 35s als geleverd resultaat is de consistente conventie.
      id: 'vo2_4020',
      naam: '40/20\'s',
      tss_range: [69, 90],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_4020_kort',
          zwaartegewicht: 1,
          naam: '10× [40"+20"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.888889 },
          ]
        },
        {
          id: 'vo2_4020_middel',
          zwaartegewicht: 2,
          naam: '2× 7× [40"+20"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 7 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.8 },
          ]
        },
        {
          id: 'vo2_4020_lang',
          zwaartegewicht: 3,
          naam: '3× 10× [40"+20"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.007407, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.003704, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.555556 },
          ]
        },
      ]
    },

    {
      // Rønnestad & Hansen (2013/2020) — 30s@~110%FTP / 15s@~50%FTP, 2:1
      // werk/rust-verhouding (vs. vo2_4020's 40/20 op dezelfde 2:1-ratio, maar
      // korter en met meer herhalingen). Slechts 2 varianten (geen "zwaar")
      // omdat het bronprotocol zelf maar één gevalideerde dosering kent (3×13)
      // naast een lichtere introductieversie.
      id: 'vo2_3015',
      naam: 'Rønnestad 30/15',
      tss_range: [68, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_3015_kort',
          zwaartegewicht: 1,
          naam: '2× 9× [30"+15"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.005556, reps: 9 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 50,  duur_pct: 0.002778, reps: 9 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.005556, reps: 9 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 50,  duur_pct: 0.002778, reps: 9 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.816667 },
          ]
        },
        {
          id: 'vo2_3015_standaard',
          zwaartegewicht: 2,
          naam: '3× 13× [30"+15"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.005556, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 50,  duur_pct: 0.002778, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.005556, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 50,  duur_pct: 0.002778, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.005556, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 50,  duur_pct: 0.002778, reps: 13 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.608333 },
          ]
        },
      ]
    },

    {
      // Billat — 1:1 werk/rust-verhouding (i.p.v. vo2_4020/vo2_3015's 2:1),
      // geen sets-structuur: één doorlopende reeks reps.
      id: 'vo2_3030',
      naam: 'Billat 30/30',
      tss_range: [64, 67],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_3030_kort',
          zwaartegewicht: 1,
          naam: '12× [30"+30"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 102, duur_pct: 0.005556, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.866667 },
          ]
        },
        {
          id: 'vo2_3030_middel',
          zwaartegewicht: 2,
          naam: '16× [30"+30"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 102, duur_pct: 0.005556, reps: 16 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 16 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.822222 },
          ]
        },
        {
          id: 'vo2_3030_lang',
          zwaartegewicht: 3,
          naam: '20× [30"+30"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 102, duur_pct: 0.005556, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.777778 },
          ]
        },
      ]
    },

    {
      // Gunnarsson & Bangsbo (2012) — binnen elk 5-min blok: 30s laag / 20s
      // Z3 / 10s maximaal, 5× herhaald (5×60s = exact 5 min). "Laag" is hier
      // Z2 i.p.v. Z1 (zie chunk 0-rapportage): Z1 is alleen toegestaan voor
      // sprint_neuraal/z6_anaeroob/kracht_lage_cadans-sessietypes en 3 met-naam
      // genoemde gemengd-archetypes (valideerZ1Gebruik) — vo2max_intervallen
      // staat niet in die lijst. 50-60% FTP past ook prima binnen Z2, dus geen
      // uitzondering nodig op de bestaande Z1-regel. "Piek" (10s maximaal) volgt
      // de bestaande sprint_kort-conventie: zone Z7, pct_ftp 200 (geen exacte
      // %FTP-target uit het protocol, puur "maximaal haalbaar").
      id: 'vo2_102030',
      naam: '10-20-30',
      tss_range: [70, 75],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_102030_kort',
          zwaartegewicht: 1,
          naam: '2× 5× [30"+20"+10"]',
          blokken: [
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 5 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80,  duur_pct: 0.003704, reps: 5 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.001852, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 5 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80,  duur_pct: 0.003704, reps: 5 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.001852, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.855556 },
          ]
        },
        {
          id: 'vo2_102030_standaard',
          zwaartegewicht: 2,
          naam: '3× 5× [30"+20"+10"]',
          blokken: [
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 5 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80,  duur_pct: 0.003704, reps: 5 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.001852, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 5 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80,  duur_pct: 0.003704, reps: 5 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.001852, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 55,  duur_pct: 0.005556, reps: 5 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 80,  duur_pct: 0.003704, reps: 5 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.001852, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.766667 },
          ]
        },
      ]
    },

    {
      // Descending ladder — coach-praktijk (EVOQ.BIKE), geen RCT. Enige
      // archetype in dit bestand dat duur_sec_vast gebruikt: de ladder-rungs
      // zijn een vaste, niet-schalende structuur (een 3-min rung moet altijd 3
      // min blijven, niet uitrekken bij een lange sessie of inkrimpen bij een
      // korte) — zie schaalVariant's duur_sec_vast-pad. Alleen het afsluitende
      // Z2-herstelblok is duur_pct (schaalbaar) en vangt het verschil tussen de
      // vaste ladder (~20 min) en de gevraagde sessieduur op.
      id: 'vo2_afbouwend',
      naam: 'Afbouwende ladder',
      tss_range: [45, 94],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_afb_ladder',
          zwaartegewicht: 3,
          naam: 'Afbouwende ladder 3\'-2\'-1\'-45"-5×30"',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_sec_vast: 180 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_sec_vast: 120 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_sec_vast: 120 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_sec_vast: 80 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_sec_vast: 60 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_sec_vast: 40 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_sec_vast: 45 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_sec_vast: 30 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_sec_vast: 30, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_sec_vast: 20, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 1.0 },
          ]
        },
      ]
    },

    {
      id: 'vo2_microbursts',
      naam: 'Microbursts',
      tss_range: [60, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_microbursts_15rep',
          zwaartegewicht: 1,
          naam: '15× [15"+15"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.015, reps: 15 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.015, reps: 15 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.550 },
          ]
        },
        {
          id: 'vo2_microbursts_18rep',
          zwaartegewicht: 2,
          naam: '18× [15"+15"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 125, duur_pct: 0.015, reps: 18 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.015, reps: 18 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.460 },
          ]
        },
        {
          id: 'vo2_microbursts_20rep',
          zwaartegewicht: 3,
          naam: '20× [15"+15"] zwaarder',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 130, duur_pct: 0.015, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.015, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.400 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1 (korte-reps-familie): alle 3 hadden hetzelfde
      // rust-artefact (herstel-blok tussen reps disproportioneel lang t.o.v.
      // de naam) — werk- én herstelduur onafhankelijk herkalibreerd op de
      // eigen naam en de archetype-structuur ("2 min Z2 herstel").
      id: 'vo2_kort',
      naam: 'Korte intervallen',
      tss_range: [72, 78],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_kort_10x1',
          zwaartegewicht: 2,
          naam: '10× 1\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 123, duur_pct: 0.011111, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.66667 },
          ]
        },
        {
          id: 'vo2_kort_12x1',
          zwaartegewicht: 3,
          naam: '12× 1\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 122, duur_pct: 0.011111, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.600004 },
          ]
        },
        {
          id: 'vo2_kort_8x90',
          zwaartegewicht: 1,
          naam: '8× 90"',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.016667, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022222, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.688888 },
          ]
        },
      ]
    },

    {
      id: 'vo2_lang',
      naam: 'Lange VO2max-blokken',
      tss_range: [82, 86],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_lang_3x7',
          zwaartegewicht: 1,
          naam: '3× 7\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 108, duur_pct: 0.077778, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.077778, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.533333 },
          ]
        },
        {
          id: 'vo2_lang_3x8',
          zwaartegewicht: 2,
          naam: '3× 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.088889, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.077778, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.5 },
          ]
        },
        {
          id: 'vo2_lang_4x6',
          zwaartegewicht: 3,
          naam: '4× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.066667, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.077778, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.422222 },
          ]
        },
      ]
    },

    {
      id: 'vo2_oplopend',
      naam: 'Oplopende VO2max',
      tss_range: [77, 81],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_opl_5x3',
          zwaartegewicht: 1,
          naam: '5× 3\' (106→118%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.033333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.655556 },
          ]
        },
        {
          id: 'vo2_opl_6x2',
          zwaartegewicht: 2,
          naam: '6× 2\' (106→121%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 121, duur_pct: 0.022222 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.644444 },
          ]
        },
        {
          id: 'vo2_opl_4x4',
          zwaartegewicht: 3,
          naam: '4× 4\' (106→115%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044444 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.044444 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.688889 },
          ]
        },
      ]
    },

    {
      id: 'vo2_klim',
      naam: 'Klimsimulatie',
      tss_range: [81, 87],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen'],
      varianten: [
        {
          id: 'vo2_klim_6x3',
          zwaartegewicht: 2,
          naam: '6× 3\' @ 116%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 116, duur_pct: 0.033333, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.466667 },
          ]
        },
        {
          id: 'vo2_klim_8x2',
          zwaartegewicht: 3,
          naam: '8× 2\' @ 118%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.022222, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.377778 },
          ]
        },
        {
          id: 'vo2_klim_5x3half',
          zwaartegewicht: 1,
          naam: '5× 3\'30" @ 114%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 114, duur_pct: 0.038889, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.527778 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 6: SPRINT ─────────────────────────────────────────────────

  sprint_neuraal: [
    {
      // Vervolgticket chunk 1 (korte-reps-familie): som=0.998/1.02/0.991 —
      // alle 3 lagen al binnen 2% tolerantie (dus niet op de oorspronkelijke
      // 41-lijst), maar hadden toch het rust-artefact (Z1-herstel 2-3× te
      // lang t.o.v. de archetype-structuur "3 min Z1 herstel") — zelfde les
      // als bij ou_std_8x90plus45/ou_lang_5x2half. Werkblok-duur (Z7) bewust
      // ONGEWIJZIGD gelaten: die loopt file-breed 30-100% over t.o.v. de naam,
      // een apart, breder patroon buiten scope van dit ticket (zie
      // vervolgticket-notitie).
      id: 'sprint_kort',
      naam: 'Korte sprints',
      tss_range: [64, 67],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      varianten: [
        {
          id: 'spr_k_8x10',
          zwaartegewicht: 1,
          naam: '8× 10"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.022, reps: 8 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.033333, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.557336 },
          ]
        },
        {
          id: 'spr_k_10x10',
          zwaartegewicht: 2,
          naam: '10× 10"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.018, reps: 10 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.033333, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.48667 },
          ]
        },
        {
          id: 'spr_k_6x12',
          zwaartegewicht: 3,
          naam: '6× 12"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.027, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.033333, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.638002 },
          ]
        },
      ]
    },

    {
      // Zelfde patroon en zelfde uitzondering (werkblok-duur ongewijzigd) als
      // sprint_kort hierboven — allemaal buiten de oorspronkelijke 41 (som
      // 0.97-1.0) maar wel het Z1-rust-artefact (2-3× de gestelde 4 min).
      id: 'sprint_lang',
      naam: 'Langere sprints',
      tss_range: [63, 67],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'spr_l_6x15',
          zwaartegewicht: 1,
          naam: '6× 15"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 190, duur_pct: 0.033, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.044444, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.535336 },
          ]
        },
        {
          id: 'spr_l_8x15',
          zwaartegewicht: 2,
          naam: '8× 15"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 190, duur_pct: 0.025, reps: 8 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.044444, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.444448 },
          ]
        },
        {
          id: 'spr_l_5x20',
          zwaartegewicht: 3,
          naam: '5× 20"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 185, duur_pct: 0.044, reps: 5 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.044444, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.55778 },
          ]
        },
      ]
    },

    {
      id: 'sprint_ingebed',
      naam: 'Embedded sprints',
      tss_range: [60, 85],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      varianten: [
        {
          id: 'spr_inb_5',
          zwaartegewicht: 1,
          naam: '5 sprints willekeurig verdeeld',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.175 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.110 },
          ]
        },
        {
          id: 'spr_inb_7',
          zwaartegewicht: 3,
          naam: '7 sprints willekeurig verdeeld',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66, duur_pct: 0.121 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.131 },
          ]
        },
        {
          id: 'spr_inb_6_vast',
          zwaartegewicht: 2,
          naam: '6 sprints op vaste intervallen',
          blokken: [
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'werk',   zone: 'Z2', pct_ftp: 66,  duur_pct: 0.152 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.070 },
          ]
        },
      ]
    },
  ],

  z6_anaeroob: [
    {
      // Vervolgticket chunk 1 (korte-reps-familie): raw werkwaarde (Z6) ligt
      // hier al ~5-6× boven het genoemde aantal seconden, ruim vóór enige
      // som-invloed — de archetype-cap (60s) vangt dit al af tot ~53s
      // (ongewijzigd gelaten). Alleen het Z1-herstel (was 2-3× de gestelde
      // 5 min) is hier gefixt.
      id: 'z6_standaard',
      naam: 'Anaeroob standaard',
      tss_range: [61, 63],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      doel_beperking: ['sprint','klimmen'],
      varianten: [
        {
          id: 'z6_5x40',
          zwaartegewicht: 1,
          naam: '5× 40"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 140, duur_pct: 0.044, reps: 5 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.055556, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.50222 },
          ]
        },
        {
          id: 'z6_6x35',
          zwaartegewicht: 2,
          naam: '6× 35"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 140, duur_pct: 0.039, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.055556, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.432664 },
          ]
        },
        {
          id: 'z6_4x50',
          zwaartegewicht: 3,
          naam: '4× 50"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 138, duur_pct: 0.056, reps: 4 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.055556, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.553776 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 7: GEMENGD (vrijheidsessies) ──────────────────────────────
  // Vrijheidsessies hebben één vaste variant — ze zijn zelf al de variatie

  gemengd: [
    {
      id: 'alles_mag',
      naam: 'Alles mag',
      tss_range: [60, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'alles_mag_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.008, reps: 3 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.033, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 82,  duur_pct: 0.133 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.366 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1: het slotblok ("5 min tempo" in de structuur)
      // leverde 10 min — precies dubbel. Sprint(Z7)/Z1-herstel/sweetspot(Z3)
      // ongewijzigd gelaten (sprint blijft door de systemische Z7-precisie-
      // kwestie, zie vervolgticket-notitie; sweetspot en Z1-herstel bleven al
      // binnen hun archetype-cap verzadigd, dus onveranderd na herberekening
      // — geverifieerd). Enige variant -> tss_range via duur-sweep.
      id: 'raketstart',
      naam: 'Raketstart',
      tss_range: [43, 93],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'raket_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.011, reps: 3 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.056, reps: 3 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90,  duur_pct: 0.333 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.05 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 83,  duur_pct: 0.055556 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.360444 },
          ]
        },
      ]
    },

    {
      id: 'omgekeerde_wereld',
      naam: 'Omgekeerde wereld',
      tss_range: [65, 85],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'omgekeerd_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.067, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033, reps: 2 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 90,  duur_pct: 0.250 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.249 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 3: structurele fout, geen documentatie-kwestie.
      // Archetype-cap (Z3/Z4: 540s/9min) verzadigde de Z3/Z4-fasen stilzwijgend
      // (leverde 9min i.p.v. 8min), terwijl de ongecapte Z2-fasen (Z1/Z2 zijn
      // altijd vrijgesteld van caps) hun werkelijke, te hoge auteurswaarde
      // (12min i.p.v. 8min) rechtstreeks doorgaven — geen van beide kwam uit
      // op de gestelde "8 min" per fase. Alle 7 fasen onafhankelijk
      // herkalibreerd op 8 min; archetype begint al met Z2 (geen aparte
      // warming-up-injectie nodig/toegepast), dus geen krimp-afronding — elke
      // fase levert nu exact 480s.
      id: 'pieken_en_dalen',
      naam: 'Pieken en dalen',
      tss_range: [40, 103],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'pd_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z4', pct_ftp: 98, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 0.088889 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.088889 },
            { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.377778 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1: rust-artefact tussen reps (5 min bedoeld,
      // 8 min geleverd) — werkblokken ongewijzigd gelaten (Z3/Z5/Z7 blijven
      // al door hun archetype-caps begrensd, dus geen zichtbaar effect van
      // deze fix op die blokken; geverifieerd). Enige variant, dus tss_range
      // via duur-sweep (45-120 min) i.p.v. 90-min-only — geen gewichtsas om
      // op te baseren.
      id: 'klim_simulator',
      naam: 'Klimsimulator',
      tss_range: [37, 93],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'klim_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 90,  duur_pct: 0.033, reps: 4 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.008, reps: 4 },
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.003, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.055556, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.601776 },
          ]
        },
      ]
    },

    {
      // Vervolgticket chunk 1: beide rust-blokken exact verdubbeld t.o.v. de
      // gestelde 3 min / 2 min — werkblokken (5 min drempel, 2 min VO2max)
      // matchten al exact en zijn ongewijzigd gelaten (blijven door hun
      // archetype-caps begrensd). Enige variant -> duur-sweep voor tss_range.
      id: 'negatieve_vermoeidheid',
      naam: 'Negatieve vermoeidheid',
      tss_range: [46, 104],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'negv_v1',
          zwaartegewicht: 3,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 98, duur_pct: 0.100, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.033333, reps: 3 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110,duur_pct: 0.033, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.022222, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.379113 },
          ]
        },
      ]
    },

    {
      id: 'race_simulatie',
      naam: 'Race simulatie',
      tss_range: [75, 100],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          // Structuur (sessie-archetypes.js): 10' Z2 -> 2x [3' drempel + 1' sprint]
          // -> 15' sweetspot -> 2x [2' VO2max + 30" sprint] -> 10' Z2 uitrollen.
          id: 'race_sim_standaard',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',    zone: 'Z2', pct_ftp: 65,  duur_pct: 0.208 },
            { type: 'werk',    zone: 'Z4', pct_ftp: 98,  duur_pct: 0.0625, reps: 2 },
            { type: 'werk',    zone: 'Z6', pct_ftp: 150, duur_pct: 0.0208, reps: 2 },
            { type: 'werk',    zone: 'Z3', pct_ftp: 90,  duur_pct: 0.3125 },
            { type: 'werk',    zone: 'Z5', pct_ftp: 108, duur_pct: 0.0417, reps: 2 },
            { type: 'werk',    zone: 'Z7', pct_ftp: 175, duur_pct: 0.0104, reps: 2 },
            { type: 'herstel', zone: 'Z2', pct_ftp: 60,  duur_pct: 0.208 },
          ]
        },
        {
          id: 'race_sim_licht',
          zwaartegewicht: 1,
          naam: 'Licht',
          blokken: [
            { type: 'werk',    zone: 'Z2', pct_ftp: 65,  duur_pct: 0.208 },
            { type: 'werk',    zone: 'Z4', pct_ftp: 95,  duur_pct: 0.0625, reps: 2 },
            { type: 'werk',    zone: 'Z6', pct_ftp: 140, duur_pct: 0.0208, reps: 2 },
            { type: 'werk',    zone: 'Z3', pct_ftp: 87,  duur_pct: 0.3125 },
            { type: 'werk',    zone: 'Z5', pct_ftp: 104, duur_pct: 0.0417, reps: 2 },
            { type: 'werk',    zone: 'Z7', pct_ftp: 165, duur_pct: 0.0104, reps: 2 },
            { type: 'herstel', zone: 'Z2', pct_ftp: 60,  duur_pct: 0.208 },
          ]
        },
      ]
    },
  ],
}

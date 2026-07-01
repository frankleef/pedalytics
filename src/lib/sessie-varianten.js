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
      id: 'ss_standaard',
      naam: 'Sweetspot standaard',
      tss_range: [70, 95],
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
  ],

  // ─── CATEGORIE 4: DREMPEL ────────────────────────────────────────────────

  drempel_intervallen: [
    {
      id: 'drempel_standaard',
      naam: 'Drempel standaard',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'dr_std_3x15',
          zwaartegewicht: 1,
          naam: '3× 15\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.214, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.143 },
          ]
        },
        {
          id: 'dr_std_2x20',
          zwaartegewicht: 3,
          naam: '2× 20\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.286, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.071, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.286 },
          ]
        },
        {
          id: 'dr_std_3x18',
          zwaartegewicht: 2,
          naam: '3× 18\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.257, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.057 },
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
      id: 'drempel_kort_veel',
      naam: 'Veel korte drempelblokken',
      tss_range: [70, 100],
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
      id: 'ou_standaard',
      naam: 'Over-unders',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      varianten: [
        {
          id: 'ou_std_6x2plus1',
          zwaartegewicht: 2,
          naam: '6× [2\'+1\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.044, reps: 6 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.022, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.044, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.136 },
          ]
        },
        {
          id: 'ou_std_8x90plus45',
          zwaartegewicht: 1,
          naam: '8× [90"+45"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.033, reps: 8 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.017, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.328 },
          ]
        },
        {
          id: 'ou_std_5x2half',
          zwaartegewicht: 3,
          naam: '5× [2\'30"+75"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.058, reps: 5 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 105, duur_pct: 0.029, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.058, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.148 },
          ]
        },
      ]
    },

    {
      id: 'ou_lang',
      naam: 'Lange over-unders',
      tss_range: [75, 100],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'ou_lang_4x3plus2',
          zwaartegewicht: 2,
          naam: '4× [3\'+2\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.060, reps: 4 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.040, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.132 },
          ]
        },
        {
          id: 'ou_lang_5x2half',
          zwaartegewicht: 1,
          naam: '5× [2\'30"+2\']',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.050, reps: 5 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.040, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.060, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.250 },
          ]
        },
        {
          id: 'ou_lang_3x4plus2half',
          zwaartegewicht: 3,
          naam: '3× [4\'+2\'30"]',
          blokken: [
            { type: 'werk',   zone: 'Z3', pct_ftp: 88,  duur_pct: 0.089, reps: 3 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 103, duur_pct: 0.056, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.078, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.175 },
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
      id: 'pyr_volledig',
      naam: 'Volledige pyramide',
      tss_range: [80, 105],
      fase_beschikbaar: ['drempel','vo2max','consolidatie'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'pyr_vol_2_4_6_4_2',
          zwaartegewicht: 1,
          naam: '2\'–4\'–6\'–4\'–2\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.056 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.028 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.111 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.028 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.028 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.111 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.028 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.056 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.387 },
          ]
        },
        {
          id: 'pyr_vol_3_5_8_5_3',
          zwaartegewicht: 2,
          naam: '3\'–5\'–8\'–5\'–3\'',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.063 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.025 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.104 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.025 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.167 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.025 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.104 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.025 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.063 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.399 },
          ]
        },
        {
          id: 'pyr_vol_2x',
          zwaartegewicht: 3,
          naam: '2× [2\'–4\'–6\'–4\'–2\']',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.028, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.014, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.056, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.014, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.083, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.014, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.056, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.014, reps: 2 },
            { type: 'werk',   zone: 'Z4', pct_ftp: 100, duur_pct: 0.028, reps: 2 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.194 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 5: VO2MAX ─────────────────────────────────────────────────

  vo2max_intervallen: [
    {
      id: 'vo2_5x5',
      naam: 'Klassieke 5×5',
      tss_range: [70, 90],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'vo2_5x5_std',
          zwaartegewicht: 2,
          naam: '5× 5\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.077, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.077, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.115 },
          ]
        },
        {
          id: 'vo2_6x4',
          zwaartegewicht: 3,
          naam: '6× 4\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.062, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.062, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.124 },
          ]
        },
        {
          id: 'vo2_4x6',
          zwaartegewicht: 1,
          naam: '4× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 108, duur_pct: 0.092, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.092, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.064 },
          ]
        },
      ]
    },

    {
      id: 'vo2_4x4',
      naam: 'Rønnestad 4×4',
      tss_range: [60, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'vo2_4x4_std',
          zwaartegewicht: 2,
          naam: '4× 4\' @ 115%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.067, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.198 },
          ]
        },
        {
          id: 'vo2_5x4',
          zwaartegewicht: 1,
          naam: '5× 4\' @ 112%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.067, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.165 },
          ]
        },
        {
          id: 'vo2_4x4_hard',
          zwaartegewicht: 3,
          naam: '4× 4\' @ 118%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.067, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.198 },
          ]
        },
      ]
    },

    {
      id: 'vo2_4020',
      naam: '40/20\'s',
      tss_range: [60, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_4020_20rep',
          zwaartegewicht: 2,
          naam: '20× [40"+20"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.022, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.011, reps: 20 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.340 },
          ]
        },
        {
          id: 'vo2_4020_15rep',
          zwaartegewicht: 3,
          naam: '15× [40"+20"] zwaarder',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 125, duur_pct: 0.022, reps: 15 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.011, reps: 15 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.505 },
          ]
        },
        {
          id: 'vo2_3020_25rep',
          zwaartegewicht: 1,
          naam: '25× [30"+15"]',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 120, duur_pct: 0.017, reps: 25 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.008, reps: 25 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.375 },
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
      id: 'vo2_kort',
      naam: 'Korte intervallen',
      tss_range: [55, 80],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_kort_10x1',
          zwaartegewicht: 2,
          naam: '10× 1\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 123, duur_pct: 0.040, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.080, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.000 },
          ]
        },
        {
          id: 'vo2_kort_12x1',
          zwaartegewicht: 3,
          naam: '12× 1\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 122, duur_pct: 0.033, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 12 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.004 },
          ]
        },
        {
          id: 'vo2_kort_8x90',
          zwaartegewicht: 1,
          naam: '8× 90"',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.060, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.100, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.080 },
          ]
        },
      ]
    },

    {
      id: 'vo2_lang',
      naam: 'Lange VO2max-blokken',
      tss_range: [75, 100],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_lang_3x7',
          zwaartegewicht: 1,
          naam: '3× 7\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 108, duur_pct: 0.108, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.108, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.148 },
          ]
        },
        {
          id: 'vo2_lang_3x8',
          zwaartegewicht: 2,
          naam: '3× 8\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.123, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.123, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.139 },
          ]
        },
        {
          id: 'vo2_lang_4x6',
          zwaartegewicht: 3,
          naam: '4× 6\'',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 110, duur_pct: 0.092, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.092, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.064 },
          ]
        },
      ]
    },

    {
      id: 'vo2_oplopend',
      naam: 'Oplopende VO2max',
      tss_range: [65, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'vo2_opl_5x3',
          zwaartegewicht: 1,
          naam: '5× 3\' (106→118%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.050 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.050 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.050 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.050 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.050 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.500 },
          ]
        },
        {
          id: 'vo2_opl_6x2',
          zwaartegewicht: 2,
          naam: '6× 2\' (106→121%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.033 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 121, duur_pct: 0.033 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.604 },
          ]
        },
        {
          id: 'vo2_opl_4x4',
          zwaartegewicht: 3,
          naam: '4× 4\' (106→115%)',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 106, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 109, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 112, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 115, duur_pct: 0.067 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.399 },
          ]
        },
      ]
    },

    {
      id: 'vo2_klim',
      naam: 'Klimsimulatie',
      tss_range: [60, 85],
      fase_beschikbaar: ['drempel', 'consolidatie', 'vo2max'],
      week_in_fase_min: 2,
      doel_beperking: ['klimmen'],
      varianten: [
        {
          id: 'vo2_klim_6x3',
          zwaartegewicht: 2,
          naam: '6× 3\' @ 116%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 116, duur_pct: 0.050, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.083, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.200 },
          ]
        },
        {
          id: 'vo2_klim_8x2',
          zwaartegewicht: 3,
          naam: '8× 2\' @ 118%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 118, duur_pct: 0.033, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.067, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.200 },
          ]
        },
        {
          id: 'vo2_klim_5x3half',
          zwaartegewicht: 1,
          naam: '5× 3\'30" @ 114%',
          blokken: [
            { type: 'werk',   zone: 'Z5', pct_ftp: 114, duur_pct: 0.058, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.083, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.125 },
          ]
        },
      ]
    },
  ],

  // ─── CATEGORIE 6: SPRINT ─────────────────────────────────────────────────

  sprint_neuraal: [
    {
      id: 'sprint_kort',
      naam: 'Korte sprints',
      tss_range: [30, 45],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      varianten: [
        {
          id: 'spr_k_8x10',
          zwaartegewicht: 1,
          naam: '8× 10"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.022, reps: 8 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.100, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.022 },
          ]
        },
        {
          id: 'spr_k_10x10',
          zwaartegewicht: 2,
          naam: '10× 10"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.018, reps: 10 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.082, reps: 10 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.020 },
          ]
        },
        {
          id: 'spr_k_6x12',
          zwaartegewicht: 3,
          naam: '6× 12"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 200, duur_pct: 0.027, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.109, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.175 },
          ]
        },
      ]
    },

    {
      id: 'sprint_lang',
      naam: 'Langere sprints',
      tss_range: [35, 50],
      fase_beschikbaar: ['basis', 'sweetspot', 'overgangsfase', 'drempel', 'consolidatie', 'test', 'vo2max'],
      week_in_fase_min: 2,
      varianten: [
        {
          id: 'spr_l_6x15',
          zwaartegewicht: 1,
          naam: '6× 15"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 190, duur_pct: 0.033, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.100, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.202 },
          ]
        },
        {
          id: 'spr_l_8x15',
          zwaartegewicht: 2,
          naam: '8× 15"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 190, duur_pct: 0.025, reps: 8 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.083, reps: 8 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.136 },
          ]
        },
        {
          id: 'spr_l_5x20',
          zwaartegewicht: 3,
          naam: '5× 20"',
          blokken: [
            { type: 'werk',   zone: 'Z7', pct_ftp: 185, duur_pct: 0.044, reps: 5 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.133, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.085 },
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
      id: 'z6_standaard',
      naam: 'Anaeroob standaard',
      tss_range: [50, 70],
      fase_beschikbaar: ['sweetspot','drempel','vo2max','consolidatie'],
      doel_beperking: ['sprint','klimmen'],
      varianten: [
        {
          id: 'z6_5x40',
          zwaartegewicht: 1,
          naam: '5× 40"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 140, duur_pct: 0.044, reps: 5 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.222, reps: 5 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.110 },
          ]
        },
        {
          id: 'z6_6x35',
          zwaartegewicht: 2,
          naam: '6× 35"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 140, duur_pct: 0.039, reps: 6 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.194, reps: 6 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.106 },
          ]
        },
        {
          id: 'z6_4x50',
          zwaartegewicht: 3,
          naam: '4× 50"',
          blokken: [
            { type: 'werk',   zone: 'Z6', pct_ftp: 138, duur_pct: 0.056, reps: 4 },
            { type: 'herstel',zone: 'Z1', pct_ftp: 45,  duur_pct: 0.222, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.112 },
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
      id: 'raketstart',
      naam: 'Raketstart',
      tss_range: [55, 80],
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
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.050 },
            { type: 'werk',   zone: 'Z3', pct_ftp: 83,  duur_pct: 0.117 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.232 },
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
      id: 'pieken_en_dalen',
      naam: 'Pieken en dalen',
      tss_range: [60, 80],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'pd_v1',
          zwaartegewicht: 2,
          naam: 'Standaard',
          blokken: [
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z4', pct_ftp: 98, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z3', pct_ftp: 90, duur_pct: 0.133 },
            { type: 'werk', zone: 'Z2', pct_ftp: 66, duur_pct: 0.132 },
            { type: 'herstel', zone: 'Z2', pct_ftp: 63, duur_pct: 0.068 },
          ]
        },
      ]
    },

    {
      id: 'klim_simulator',
      naam: 'Klimsimulator',
      tss_range: [65, 85],
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
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.083, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63,  duur_pct: 0.364 },
          ]
        },
      ]
    },

    {
      id: 'negatieve_vermoeidheid',
      naam: 'Negatieve vermoeidheid',
      tss_range: [70, 90],
      fase_beschikbaar: ['sweetspot', 'drempel', 'consolidatie', 'vo2max'],
      varianten: [
        {
          id: 'negv_v1',
          zwaartegewicht: 3,
          naam: 'Standaard',
          blokken: [
            { type: 'werk',   zone: 'Z4', pct_ftp: 98, duur_pct: 0.100, reps: 3 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.050, reps: 3 },
            { type: 'werk',   zone: 'Z5', pct_ftp: 110,duur_pct: 0.033, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.033, reps: 4 },
            { type: 'herstel',zone: 'Z2', pct_ftp: 63, duur_pct: 0.216 },
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

// Variant-rotatiesleutels voor KV
// Format: sessie_varianten:{userId}:{archetype_id} → array van max 3 variant-ids
export function getVariantKvSleutel(userId, archetypeId) {
  return `sessie_varianten:${userId}:${archetypeId}`
}

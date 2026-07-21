import { describe, it, expect } from 'vitest'
import { bouwWbalAfwijkingTekst } from '../wbalAfwijking.js'

// SchemaTab.js zelf bevat JSX en kan niet rechtstreeks geïmporteerd worden
// door Vite's esbuild-transform in deze omgeving (geen jsdom/@testing-library/
// react) — zelfde reden als reviewVoorstelActies.js (Blok F, fase 5). Deze
// pure tekstfunctie staat daarom in een apart, JSX-vrij bestand en wordt hier
// direct getest.

describe('bouwWbalAfwijkingTekst', () => {
  it('toont de afwijking-indicator alleen wanneer er daadwerkelijk een afwijking is (interval)', () => {
    const seg = { type: 'werk', blokDuurSeconden: 215, standaardBlokDuurSeconden: 40 }
    expect(bouwWbalAfwijkingTekst(seg)).toBe(`interval: 3:35 (standaard 40s, CP/W'-gekalibreerd)`)
  })

  it('toont de afwijking-indicator voor een rust-segment met het label "rust"', () => {
    const seg = { type: 'herstel', blokDuurSeconden: 265, standaardBlokDuurSeconden: 40 }
    expect(bouwWbalAfwijkingTekst(seg)).toBe(`rust: 4:25 (standaard 40s, CP/W'-gekalibreerd)`)
  })

  it('geeft null terug zonder standaardBlokDuurSeconden (geen kalibratie toegepast)', () => {
    expect(bouwWbalAfwijkingTekst({ type: 'werk', blokDuurSeconden: 240 })).toBeNull()
  })

  it('geeft null terug als de gekalibreerde duur toevallig exact gelijk is aan de standaardduur', () => {
    expect(bouwWbalAfwijkingTekst({ type: 'werk', blokDuurSeconden: 240, standaardBlokDuurSeconden: 240 })).toBeNull()
  })

  it('geeft null terug voor een ontbrekend/leeg segment, geen crash', () => {
    expect(bouwWbalAfwijkingTekst(null)).toBeNull()
    expect(bouwWbalAfwijkingTekst(undefined)).toBeNull()
  })

  it('formatteert onder de 60s als pure seconden, zonder minuten-notatie', () => {
    const seg = { type: 'werk', blokDuurSeconden: 45, standaardBlokDuurSeconden: 60 }
    expect(bouwWbalAfwijkingTekst(seg)).toBe(`interval: 45s (standaard 1:00, CP/W'-gekalibreerd)`)
  })
})

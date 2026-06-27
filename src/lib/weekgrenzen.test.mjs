// node --experimental-vm-modules src/lib/weekgrenzen.test.mjs
import { weeknummerVoorDatum, tssDoelWeek1 } from './weekgrenzen.js'

let ok = 0, fail = 0
function test(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); ok++ }
  catch (e) { console.error(`  ✗ ${label}: ${e.message}`); fail++ }
}
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`verwacht ${expected}, kreeg ${val}`)
    }
  }
}

// --- weeknummerVoorDatum ---
// Startdatum za 20 jun 2026 → getMaandagVanWeek = ma 15 jun
// Week 1: 15-21 jun, Week 2: 22-28 jun, Week 3: 29 jun+
const ZA20 = '2026-06-20'

console.log('\nweeknum met startdatum za 20 jun (getMaandag=15 jun):')
test('za 20 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-20', ZA20)).toBe(1))
test('zo 21 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-21', ZA20)).toBe(1))
test('ma 22 jun → week 2', () => expect(weeknummerVoorDatum('2026-06-22', ZA20)).toBe(2))
test('zo 28 jun → week 2', () => expect(weeknummerVoorDatum('2026-06-28', ZA20)).toBe(2))
test('ma 29 jun → week 3', () => expect(weeknummerVoorDatum('2026-06-29', ZA20)).toBe(3))

// Startdatum di 23 jun 2026 → getMaandagVanWeek = ma 22 jun
// Week 1: 22-28 jun, Week 2: 29 jun+
const DI23 = '2026-06-23'

console.log('\nweeknum met startdatum di 23 jun (getMaandag=22 jun):')
test('di 23 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-23', DI23)).toBe(1))
test('zo 28 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-28', DI23)).toBe(1))
test('ma 29 jun → week 2', () => expect(weeknummerVoorDatum('2026-06-29', DI23)).toBe(2))

// Startdatum ma 22 jun 2026 → getMaandagVanWeek = ma 22 jun
// Week 1: 22-28 jun, Week 2: 29 jun+
const MA22 = '2026-06-22'

console.log('\nweeknum met startdatum ma 22 jun (getMaandag=22 jun):')
test('ma 22 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-22', MA22)).toBe(1))
test('zo 28 jun → week 1', () => expect(weeknummerVoorDatum('2026-06-28', MA22)).toBe(1))
test('ma 29 jun → week 2', () => expect(weeknummerVoorDatum('2026-06-29', MA22)).toBe(2))

// --- tssDoelWeek1 ---
console.log('\ntssDoelWeek1:')
// za 20 jun: getMaandag=15 jun, eersteZondag=21 jun 23:59
// start=20 jun 00:00, beschikbaar=(21 23:59-20 00:00)/86400000 ≈ 1.9999 → round=2
// tss = round(253 * 2/7) = round(72.3) = 72
test('za 20 jun, doel 253 → 72 (2/7)', () => expect(tssDoelWeek1(253, ZA20)).toBe(72))

// di 23 jun: getMaandag=22 jun, eersteZondag=28 jun 23:59
// start=23 jun 00:00, beschikbaar=(28 23:59-23 00:00)/86400000 ≈ 5.9999 → round=6
// tss = round(253 * 6/7) = round(216.9) = 217
test('di 23 jun, doel 253 → 217 (6/7)', () => expect(tssDoelWeek1(253, DI23)).toBe(217))

// ma 22 jun: getMaandag=22 jun, eersteZondag=28 jun 23:59
// start=22 jun 00:00, beschikbaar=(28 23:59-22 00:00)/86400000 ≈ 6.9999 → round=7
// tss = round(253 * 7/7) = 253
test('ma 22 jun, doel 253 → 253 (7/7)', () => expect(tssDoelWeek1(253, MA22)).toBe(253))

console.log(`\n${ok + fail} tests — ${ok} ✓  ${fail} ✗`)
if (fail > 0) process.exit(1)

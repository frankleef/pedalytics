// node src/lib/sessie/weekpatroon.test.mjs
import { magSprintStaartje } from "./weekpatroon.js";

let ok = 0, fail = 0;
function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${label}: ${e.message}`);
    fail++;
  }
}
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`Got ${JSON.stringify(val)}, expected ${JSON.stringify(expected)}`);
    },
  };
}

function maakSessie(datum, sessietype, tssMax, rol = "aerobe_dag") {
  return {
    datum,
    intentie: {
      rol,
      sessietype,
      tss_range: { min: Math.round(tssMax * 0.7), max: tssMax },
    },
  };
}

const LANGSTE_Z2 = maakSessie("2026-06-28", "z2_vlak", 100);
const KORTSTE_Z2 = maakSessie("2026-06-26", "z2_variabel", 60);

console.log("magSprintStaartje tests:");

test("herstelweek → false", () => {
  const week = { weektype: "herstel", dagen: [LANGSTE_Z2] };
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("week met sprint_neuraal-sessie → false", () => {
  const sprintSessie = maakSessie("2026-06-24", "sprint_neuraal", 40, "intensiteitsdag");
  const week = { weektype: "opbouw", dagen: [LANGSTE_Z2, sprintSessie] };
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("langste Z2-dag maar naast intensiteitsdag (< 24u) → false", () => {
  const intensiteitsDag = maakSessie("2026-06-27", "sweetspot_intervallen", 80, "intensiteitsdag");
  const week = { weektype: "opbouw", dagen: [LANGSTE_Z2, intensiteitsDag] };
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("TSB −30 → false", () => {
  const week = { weektype: "opbouw", dagen: [LANGSTE_Z2] };
  expect(magSprintStaartje(week, LANGSTE_Z2, -30)).toBe(false);
});

test("langste Z2-dag, geen blokkades, TSB −10 → true", () => {
  const week = { weektype: "opbouw", dagen: [LANGSTE_Z2, KORTSTE_Z2] };
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(true);
});

test("kortste Z2-dag van een week met twee Z2-sessies → false", () => {
  const week = { weektype: "opbouw", dagen: [LANGSTE_Z2, KORTSTE_Z2] };
  expect(magSprintStaartje(week, KORTSTE_Z2, -10)).toBe(false);
});

console.log(`\n${ok}/${ok + fail} geslaagd${fail > 0 ? " — " + fail + " mislukt" : ""}`);
if (fail > 0) process.exit(1);

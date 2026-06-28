import { magSprintStaartje } from "./weekpatroon.js";

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

function maakWeek(weektype, dagen) {
  return { weektype, dagen };
}

const LANGSTE_Z2 = maakSessie("2026-06-28", "z2_duur", 100);
const KORTSTE_Z2 = maakSessie("2026-06-26", "z2_duur", 60);

test("herstelweek → false", () => {
  const week = maakWeek("herstel", [LANGSTE_Z2]);
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("week met sprint_neuraal-sessie → false", () => {
  const sprintSessie = maakSessie("2026-06-24", "sprint_neuraal", 40, "intensiteitsdag");
  const week = maakWeek("opbouw", [LANGSTE_Z2, sprintSessie]);
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("langste Z2-dag maar naast intensiteitsdag → false", () => {
  const intensiteitsDag = maakSessie("2026-06-27", "sweetspot_intervallen", 80, "intensiteitsdag");
  const week = maakWeek("opbouw", [LANGSTE_Z2, intensiteitsDag]);
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(false);
});

test("TSB −30 → false", () => {
  const week = maakWeek("opbouw", [LANGSTE_Z2]);
  expect(magSprintStaartje(week, LANGSTE_Z2, -30)).toBe(false);
});

test("langste Z2-dag, geen blokkades, TSB −10 → true", () => {
  const week = maakWeek("opbouw", [LANGSTE_Z2, KORTSTE_Z2]);
  expect(magSprintStaartje(week, LANGSTE_Z2, -10)).toBe(true);
});

test("kortste Z2-dag van een week met twee Z2-sessies → false", () => {
  const week = maakWeek("opbouw", [LANGSTE_Z2, KORTSTE_Z2]);
  expect(magSprintStaartje(week, KORTSTE_Z2, -10)).toBe(false);
});

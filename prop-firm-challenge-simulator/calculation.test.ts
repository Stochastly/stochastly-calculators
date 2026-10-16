import test from "node:test";
import assert from "node:assert/strict";
import { brownianPassProbability, evaluatePath, simulate, wilson, type Inputs } from "./first_passage.ts";

const base: Inputs = { targetPct: 2, totalLossPct: 1, dailyLossPct: 100, minDays: 0, horizonDays: null,
  driftPct: 0, volatilityPct: 1, simulations: 1000, seed: 123456, driftSdPct: 0 };

test("closed form at zero drift: b / (a + b)", () => {
  assert.equal(brownianPassProbability(2, 1, 0, 1), 1 / 3);
  assert.ok(brownianPassProbability(2, 1, 0.2, 1) > 1 / 3, "a positive drift helps");
});

test("the same seed replays the same counts", () => {
  const x: Inputs = { targetPct: 8, dailyLossPct: 5, totalLossPct: 10, minDays: 5, horizonDays: 120,
    driftPct: 0.08, volatilityPct: 1.2, simulations: 3000, seed: 20261003, driftSdPct: 0.06 };
  assert.deepEqual(simulate(x).counts, { pass: 2155, daily: 3, total: 558, censored: 284 });
  assert.deepEqual(simulate(x).counts, simulate(x).counts);
});

test("an intraday daily-loss breach counts even if the day closes higher", () => {
  const x = { ...base, targetPct: 100, dailyLossPct: 3, totalLossPct: 100, horizonDays: 1, checksPerDay: 4 as const };
  const steps = [-4, 5, 0, 0];
  let i = 0;
  assert.equal(evaluatePath(x, () => steps[i++] ?? 0, 1).outcome, "daily");
});

test("the Wilson interval contains the observed share", () => {
  const w = wilson(30, 100);
  assert.ok(w.low < 0.3 && 0.3 < w.high);
});

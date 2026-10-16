import test from "node:test";
import assert from "node:assert/strict";
import { explorer, type ExplorerInput } from "./mintrl.ts";
import { minTrl, perPeriod, psr } from "./sharpe.ts";

const base: ExplorerInput = {
  srAnnual: 2, benchmarkAnnual: 1, periodsPerYear: 12, skew: -0.72, kurtosis: 5.78,
  confidence: 0.95, observations: 60, sharpeFrom: 0.5, sharpeTo: 3, kurtosisFrom: 3, kurtosisTo: 11,
};

test("paper value: Bailey and Lopez de Prado (2012), Appendix A.3, 59.895 observations", () => {
  const result = explorer(base);
  assert.equal(result.observations!.toFixed(3), "59.895");
  assert.equal(result.years!.toFixed(2), "4.99");
});

test("PSR at T = MinTRL gives back the confidence level", () => {
  for (const srAnnual of [1.1, 1.5, 2, 2.5, 3]) {
    const sr = perPeriod(srAnnual, 12), srStar = perPeriod(1, 12);
    const t = minTrl({ sr, srStar, skew: -0.72, kurtosis: 5.78, confidence: 0.95 });
    assert.ok(Math.abs(psr({ sr, srStar, t, skew: -0.72, kurtosis: 5.78 }) - 0.95) < 1e-9);
  }
});

test("a higher Sharpe ratio shortens the record", () => {
  const years = explorer(base).sharpeCurve.filter(p => p.years !== null).map(p => p.years!);
  assert.ok(years.length > 2);
  for (let i = 1; i < years.length; i++) assert.ok(years[i] <= years[i - 1]);
});

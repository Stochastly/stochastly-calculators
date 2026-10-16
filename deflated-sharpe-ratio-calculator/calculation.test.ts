import test from "node:test";
import assert from "node:assert/strict";
import { dsr, minTrl, psr, SharpeInputError } from "./sharpe.ts";
import { courbe } from "./sharpe_courbe.ts";

test("DSR paper, numerical example (Bailey and Lopez de Prado 2014, pp. 9-10): SR0 0.1132, DSR 0.9004", () => {
  const base = { sr: 2.5 / Math.sqrt(250), t: 1250, skew: -3, kurtosis: 10, variance: 0.5 / 250 };
  const r = dsr({ ...base, nTrials: 100 });
  assert.equal(r.sr0.toFixed(4), "0.1132");
  assert.equal(r.dsr.toFixed(4), "0.9004");
  assert.equal(dsr({ ...base, nTrials: 46 }).dsr.toFixed(4), "0.9505");
  assert.equal(dsr({ ...base, skew: 0, kurtosis: 3, nTrials: 88 }).dsr.toFixed(4), "0.9505");
});

test("PSR paper, Section 3 (Bailey and Lopez de Prado 2012): 0.982, 0.913, 0.953", () => {
  const sr = 1.585 / Math.sqrt(12);
  assert.equal(psr({ sr, srStar: 0, t: 24, skew: 0, kurtosis: 3 }).toFixed(3), "0.982");
  assert.equal(psr({ sr, srStar: 0, t: 24, skew: -2.448, kurtosis: 10.164 }).toFixed(3), "0.913");
  assert.equal(psr({ sr, srStar: 0, t: 36, skew: -2.448, kurtosis: 10.164 }).toFixed(3), "0.953");
});

test("PSR paper, Appendix A.3: MinTRL 59.895 observations", () => {
  const m = minTrl({ sr: 2 / Math.sqrt(12), srStar: 1 / Math.sqrt(12), skew: -0.72, kurtosis: 5.78, confidence: 0.95 });
  assert.equal(m.toFixed(3), "59.895");
});

test("the DSR curve never rises with N", () => {
  const c = courbe({ sr: 0.1581139, t: 1250, skew: -3, kurtosis: 10, periodsPerYear: 250, srStar: 0, confidence: 0.95,
    nTrials: 100, variance: 0.002, nSource: "" });
  assert.ok(c && c.points.length > 10);
  for (let i = 1; i < c.points.length; i++) assert.ok(c.points[i].dsr <= c.points[i - 1].dsr + 1e-15, `N = ${c.points[i].n}`);
});

test("inputs that overflow double precision throw a named error, never NaN", () => {
  assert.throws(() => psr({ sr: 1e200, srStar: 0, t: 1e300, skew: 0, kurtosis: 3 }), SharpeInputError);
});

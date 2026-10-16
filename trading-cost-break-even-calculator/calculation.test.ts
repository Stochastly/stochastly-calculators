import test from "node:test";
import assert from "node:assert/strict";
import { calculateCost, EXAMPLE } from "./cout_seuil.ts";

test("the page's starting case, by hand", () => {
  const r = calculateCost(EXAMPLE);
  assert.ok(Math.abs(r.composedBp - 4.5) < 1e-12);
  assert.ok(Math.abs(r.annualFrictionPct - 1.08) < 1e-12);
  assert.ok(Math.abs(r.netReturnPct - 10.92) < 1e-12);
  assert.ok(Math.abs(r.netSharpe - 10.92 / 18) < 1e-12);
  assert.ok(Math.abs(r.breakEvenBp! - 100 / 3) < 1e-12);
  assert.ok(Math.abs(r.breakEvenTrips! - 800 / 3) < 1e-12);
});

test("at the break-even cost the net return is zero", () => {
  const be = calculateCost(EXAMPLE).breakEvenBp!;
  assert.ok(Math.abs(calculateCost({ ...EXAMPLE, venueRoundTurnBp: be, extraRtBp: 0 }).netReturnPct) < 1e-12);
});

test("zero exposure has no break-even; invalid inputs are refused", () => {
  const flat = calculateCost({ ...EXAMPLE, exposure: 0 });
  assert.equal(flat.annualFrictionPct, 0);
  assert.equal(flat.breakEvenBp, null);
  for (const patch of [{ volatilityPct: 0 }, { stress: -1 }, { roundTrips: NaN }])
    assert.throws(() => calculateCost({ ...EXAMPLE, ...patch }), /must be/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { CheckInputError, checkBacktest, maxDrawdownLevels, maxDrawdownPnl, maxDrawdownReturns, moments, parseBacktestCsv } from "./check_backtest.ts";
import { dsr } from "./sharpe.ts";

const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const opts = { format: "auto" as const, nTrials: 1, periodsPerYear: 252, sharpeStdAnnual: null };

test("moments are biased (divided by T) and undefined for a constant series", () => {
  const m = moments([0.01, -0.01, 0.02, 0])!;
  close(m.mean, 0.005, 1e-15, "mean");
  close(m.sd, Math.sqrt((0.005 ** 2 + 0.015 ** 2 + 0.015 ** 2 + 0.005 ** 2) / 4), 1e-15, "sd");
  assert.equal(moments([0.01, 0.01, 0.01]), null);
});

test("drawdowns, computed by hand", () => {
  close(maxDrawdownLevels([100, 120, 90, 130, 117]), 90 / 120 - 1, 1e-15, "levels");
  close(maxDrawdownReturns([-0.1, 0.05]), -0.1, 1e-15, "a first loss counts");
  close(maxDrawdownReturns([0.1, -0.5, 0.2]), -0.5, 1e-15, "compounded");
  assert.equal(maxDrawdownPnl([100, -30, -50, 200, -10]), -80);
});

test("a returns CSV: the report's DSR is the DSR of its own moments with V = 1/T", () => {
  const returns = Array.from({ length: 300 }, (_, i) => 0.001 + 0.01 * Math.sin(i * 1.7) + 0.004 * Math.cos(i * 0.3));
  const r = checkBacktest(["return", ...returns.map(String)].join("\n"), { ...opts, nTrials: 20 });
  assert.equal(r.observations, 300);
  const m = moments(returns)!;
  close(r.sharpePerPeriod, m.sr, 1e-12, "Sharpe per period");
  const expected = dsr({ sr: m.sr, t: 300, skew: m.skew, kurtosis: m.kurtosis, nTrials: 20, variance: 1 / 300 });
  close(r.sr0, expected.sr0, 1e-12, "SR0");
  close(r.dsr, expected.dsr, 1e-12, "DSR");
  assert.equal(r.verdict, "NOT CONCLUSIVE");
});

test("more trials raise SR0 and lower the DSR", () => {
  const returns = Array.from({ length: 250 }, (_, i) => 0.002 + 0.01 * Math.sin(i * 2.3));
  const csv = ["return", ...returns.map(String)].join("\n");
  const one = checkBacktest(csv, { ...opts, nTrials: 1 });
  const many = checkBacktest(csv, { ...opts, nTrials: 100 });
  assert.equal(one.sr0, 0);
  assert.ok(many.sr0 > one.sr0 && many.dsr < one.dsr);
});

test("format detection says what it read; a day-first date is refused", () => {
  const equity = parseBacktestCsv("equity\n100\n101\n99\n102\n103");
  assert.equal(equity.format, "equity");
  assert.ok(equity.understood.length > 0);
  assert.throws(() => parseBacktestCsv("date,return\n03/04/2024,0.01\n04/04/2024,0.02"), CheckInputError);
});

test("an undefined PBO names its real cause: two configurations tied in sample", () => {
  const rows = ["a,b,c"];
  for (let t = 0; t < 64; t++) {
    const base = 0.002 + 0.01 * Math.sin(t * 1.3);
    rows.push(`${base},${t >= 60 ? base - 0.02 : base},${-0.001 + 0.01 * Math.cos(t * 0.7)}`);
  }
  const r = checkBacktest(rows.join("\n"), opts);
  assert.equal(r.pbo?.value, null);
  assert.match(r.pboNote, /splits discarded: two or more configurations tie for the best in-sample Sharpe ratio/);
});

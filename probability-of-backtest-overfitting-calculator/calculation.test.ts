import test from "node:test";
import assert from "node:assert/strict";
import { CSCVError, runCSCV, validate, type CSCVInput } from "./cscv.ts";
import { parseMatrixCSV } from "./cscv-csv.ts";

function randomMatrix(seed: number, T: number, K: number, drift = 0): number[][] {
  let state = seed;
  return Array.from({ length: T }, () => Array.from({ length: K }, (_, k) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 2 ** 32 - 0.5) * 0.04 + (k === 0 ? drift : 0);
  }));
}

test("placebo: pure noise gives a PBO near one half on average", () => {
  const pbo = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => runCSCV({ matrix: randomMatrix(seed, 160, 40), S: 8, score: "sharpe", embargo: 0, ppy: 252 }).pbo!);
  const mean = pbo.reduce((a, b) => a + b) / pbo.length;
  assert.ok(mean > 0.35 && mean < 0.65, `placebo mean ${mean}`);
});

test("positive control: one real drift among noise gives a low PBO", () => {
  const pbo = runCSCV({ matrix: randomMatrix(77, 160, 40, 0.012), S: 8, score: "sharpe", embargo: 0, ppy: 252 }).pbo!;
  assert.ok(pbo < 0.2, `drift PBO ${pbo}`);
});

test("closed form: a dominant configuration is always first out of sample, logit ln 2, PBO 0", () => {
  const matrix = Array.from({ length: 24 }, (_, t) => t % 2 === 0 ? [0.03, 0.01] : [-0.01, -0.02]);
  const r = runCSCV({ matrix, S: 4, score: "sharpe", embargo: 0, ppy: 1 });
  assert.equal(r.total, 6);
  assert.equal(r.pbo, 0);
  for (const s of r.splits) assert.ok(Math.abs(s.logit - Math.log(2)) < 1e-12);
});

test("named errors: odd S, one configuration, fewer than 4 observations per block", () => {
  const matrix = randomMatrix(1, 48, 3);
  const input: CSCVInput = { matrix, S: 4, score: "sharpe", embargo: 0, ppy: 252 };
  const fail = (patch: Partial<CSCVInput>, field: string) =>
    assert.throws(() => validate({ ...input, ...patch }), (e: unknown) => e instanceof CSCVError && e.field === field);
  fail({ S: 5 }, "S");
  fail({ matrix: matrix.map(row => row.slice(0, 1)) }, "K");
  fail({ matrix: matrix.slice(0, 11) }, "T");
});

test("CSV matrix reader: header names and numbers", () => {
  const { matrix, names } = parseMatrixCSV("a,b\n0.01,0.02\n-0.01,0.03\n");
  assert.deepEqual(names, ["a", "b"]);
  assert.deepEqual(matrix, [[0.01, 0.02], [-0.01, 0.03]]);
});

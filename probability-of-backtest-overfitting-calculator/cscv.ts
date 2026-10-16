/** Browser CSCV. The Sortino branch follows the desktop app's CSCV (2026-10-03). */
export type Score = "sharpe" | "sortino";
export type CSCVInput = { matrix: number[][]; S: number; score: Score; embargo: number; ppy: number };
/** One row per in-sample winner: a split whose k configurations tie in sample has k rows of weight 1/k (tiedWinners = k);
 *  a discarded split has one row of weight 0 with its reason. */
export type Split = { isBlocks: number[]; winner: number; isScore: number; oosScore: number; oosRank: number; omega: number; logit: number; weight: number; tiedWinners: number; reason?: string };
/** K: columns of the input; distinct: configurations after merging the columns the scores cannot tell apart (merged = K -
 *  distinct), the K of the ranks; tied: splits whose in-sample winner is shared by several configurations. */
export type CSCVResult = { pbo: number | null; total: number; used: number; tied: number; discarded: Record<string, number>; droppedRows: number; block: number; K: number; distinct: number; merged: number; T: number; splits: Split[]; histogram: { edges: number[]; counts: number[] } };
export class CSCVError extends Error { field: string; constructor(field: string, message: string) { super(`${field}: ${message}`); this.field = field; } }
export const MAX_COMBINATIONS = 20000;
export const MAX_CELLS = 1000000;
export const CSCV_VERSION = "cscv-browser-2";

export function combinations(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - k + i) / i;
  return Math.round(result);
}

export function validate(input: CSCVInput): { T: number; K: number; block: number; total: number } {
  const { matrix, S, embargo, ppy, score } = input;
  if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0])) throw new CSCVError("matrix", "enter a rectangular return matrix");
  const T = matrix.length, K = matrix[0].length;
  if (K < 2) throw new CSCVError("K", "at least two tried configurations are required");
  if (!Number.isInteger(S) || S < 4 || S % 2) throw new CSCVError("S", "enter an even integer of at least 4");
  // Same threshold as the desktop app (T < 4S: no PBO). With 3 per block here the calculator would
  // print a PBO that the app refuses.
  if (T < 4 * S) throw new CSCVError("T", "at least 4 observations per block are required (T >= 4S)");
  const total = combinations(S, S / 2);
  if (total > MAX_COMBINATIONS) throw new CSCVError("S", `C(S,S/2) = ${total} exceeds ${MAX_COMBINATIONS} splits; reduce S`);
  if (T * K > MAX_CELLS) throw new CSCVError("matrix", `T x K = ${T * K} exceeds ${MAX_CELLS} cells; reduce rows or configurations`);
  if (matrix.some(row => !Array.isArray(row) || row.length !== K || row.some(v => !Number.isFinite(v)))) throw new CSCVError("matrix", "rows must have K finite numeric returns");
  const block = Math.floor(T / S);
  if (!Number.isInteger(embargo) || embargo < 0 || embargo >= block) throw new CSCVError("embargo", "enter an integer smaller than one block");
  if (!Number.isFinite(ppy) || ppy <= 0) throw new CSCVError("ppy", "periods per year must be positive");
  if (score !== "sharpe" && score !== "sortino") throw new CSCVError("score", "select Sharpe or Sortino");
  return { T, K, block, total };
}

function* choose(n: number, k: number): Generator<number[]> {
  const a = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield [...a];
    let i = k - 1;
    while (i >= 0 && a[i] === n - k + i) i--;
    if (i < 0) return;
    a[i]++;
    for (let j = i + 1; j < k; j++) a[j] = a[j - 1] + 1;
  }
}

type Moments = { sum: number; square: number; negativeSquare: number; negatives: number; n: number };
const emptyMoments = (): Moments => ({ sum: 0, square: 0, negativeSquare: 0, negatives: 0, n: 0 });
function add(target: Moments, source: Moments): void {
  target.sum += source.sum; target.square += source.square; target.negativeSquare += source.negativeSquare;
  target.negatives += source.negatives; target.n += source.n;
}
function score(m: Moments, type: Score, ppy: number): number {
  const mean = m.sum / m.n;
  if (type === "sortino") return mean / Math.sqrt(m.negativeSquare / m.negatives) * Math.sqrt(ppy);
  const variance = (m.square - m.sum * m.sum / m.n) / (m.n - 1);
  return mean / Math.sqrt(variance) * Math.sqrt(ppy);
}

/** v * 2**n, exact while the result is a normal number (2**n alone overflows past n = 1023). */
function ldexp(v: number, n: number): number {
  for (; n > 1000; n -= 1000) v *= 2 ** 1000;
  for (; n < -1000; n += 1000) v *= 2 ** -1000;
  return v * 2 ** n;
}

/** The exponent e of m = f * 2**e with f in [0.5, 1) (Python's math.frexp), for m > 0. */
function exponent(m: number): number {
  let e = Math.ceil(Math.log2(m));
  while (ldexp(m, -e) >= 1) e++;
  while (ldexp(m, -e) < 0.5) e--;
  return e;
}

/** The in-sample winner n* = argmax of the paper is not always unique. Rule (16/10), applied identically by the
 *  desktop app, checked on shared vectors:
 *  1. Each column is divided by the power of two just above its largest absolute return. That division is EXACT, and
 *     a Sharpe or Sortino ratio computed from it is the same to the bit whatever the power: two columns with identical
 *     returns over a half get identical scores over that half, even when their other rows differ. (Up to 15/10 each
 *     divisor was the largest absolute return itself, which is not exact.)
 *  2. Columns equal after that division (identical columns, or a column and a power-of-two multiple of it such as its double; not its triple) are ONE configuration: merged
 *     before the splits, and `distinct` is the K of the ranks.
 *  3. When k configurations tie EXACTLY (same floating-point value) for the best in-sample score, the split counts
 *     (1/k) * sum over them of 1[logit < 0], and each of their logits enters the histogram with weight 1/k: the
 *     expected value of picking one tied winner at random, without drawing. */
export function runCSCV(input: CSCVInput, progress?: (done: number, total: number) => void): CSCVResult {
  const { T, K, block, total } = validate(input);
  const { S, matrix, embargo, ppy } = input;
  const droppedRows = T % S;
  const rows = matrix.slice(0, block * S);
  const peak = Array(K).fill(0) as number[];
  for (const row of rows) for (let k = 0; k < K; k++) peak[k] = Math.max(peak[k], Math.abs(row[k]));
  const shift = peak.map(m => m > 0 ? -exponent(m) : 0);
  const scaled = rows.map(row => row.map((v, k) => ldexp(v, shift[k])));
  // merge the columns equal after the exact scaling; the first occurrence keeps its index (`winner` is an input column)
  const seen = new Set<string>();
  const columns: number[] = [];
  for (let k = 0; k < K; k++) {
    const key = scaled.map(row => String(row[k])).join(",");
    if (!seen.has(key)) { seen.add(key); columns.push(k); }
  }
  const D = columns.length;
  const values = scaled.map(row => columns.map(k => row[k]));
  const full = Array.from({ length: S }, () => Array.from({ length: D }, emptyMoments));
  const trimmed = Array.from({ length: S }, () => Array.from({ length: D }, emptyMoments));
  for (let s = 0; s < S; s++) for (let t = 0; t < block; t++) for (let k = 0; k < D; k++) {
    const v = values[s * block + t][k];
    for (const m of t >= embargo ? [full[s][k], trimmed[s][k]] : [full[s][k]]) {
      m.sum += v; m.square += v * v; if (v < 0) { m.negativeSquare += v * v; m.negatives++; } m.n++;
    }
  }
  const splits: Split[] = [];
  const discarded: Record<string, number> = {};
  const lim = Math.max(3, Math.ceil(Math.log(D)));
  const edges = Array.from({ length: 33 }, (_, i) => -lim + i * 2 * lim / 32);
  const counts = Array(32).fill(0) as number[];
  const globalReason = D < 2 ? "identical configurations"
    : input.score === "sortino" && Array.from({ length: D }, (_, k) => values.every(row => row[k] >= 0)).some(Boolean) ? "global undefined Sortino ratio" : "";
  let below = 0, done = 0, tied = 0;
  for (const isBlocks of choose(S, S / 2)) {
    const selected = new Set(isBlocks);
    const isScores: number[] = [], oosScores: number[] = [];
    let reason = globalReason;
    for (let k = 0; k < D && !globalReason; k++) {
      const a = emptyMoments(), b = emptyMoments();
      for (let s = 0; s < S; s++) {
        const is = selected.has(s);
        if (is) add(a, full[s][k]);
        else add(b, s > 0 && selected.has(s - 1) ? trimmed[s][k] : full[s][k]);
      }
      isScores.push(score(a, input.score, ppy));
      oosScores.push(score(b, input.score, ppy));
      if (b.n < 5) reason = "fewer than five OOS observations after embargo";
    }
    if (!reason && [...isScores, ...oosScores].some(v => !Number.isFinite(v))) reason = "undefined IS or OOS score";
    if (reason) {
      discarded[reason] = (discarded[reason] ?? 0) + 1;
      splits.push({ isBlocks, winner: -1, isScore: NaN, oosScore: NaN, oosRank: NaN, omega: NaN, logit: NaN, weight: 0, tiedWinners: 0, reason });
    } else {
      // 2. every configuration whose in-sample score equals the maximum exactly
      const best = Math.max(...isScores);
      const winners = isScores.flatMap((v, k) => v === best ? [k] : []);
      const weight = 1 / winners.length;
      if (winners.length > 1) tied++;
      let belowHere = 0;
      for (const w of winners) {
        const winning = oosScores[w];
        const rank = oosScores.filter(v => v < winning).length + 0.5 * (oosScores.filter(v => v === winning).length + 1);
        const omega = rank / (D + 1), logit = Math.log(omega / (1 - omega));
        if (logit < 0) belowHere++;
        const bin = Math.min(31, Math.max(0, Math.floor((logit - edges[0]) / (edges[32] - edges[0]) * 32)));
        if (logit >= edges[0] && logit <= edges[32]) counts[bin] += weight;
        splits.push({ isBlocks, winner: columns[w], isScore: isScores[w], oosScore: winning, oosRank: rank, omega, logit, weight, tiedWinners: winners.length });
      }
      below += belowHere / winners.length;
    }
    done++;
    if (done % 64 === 0 || done === total) progress?.(done, total);
  }
  const used = total - Object.values(discarded).reduce((a, b) => a + b, 0);
  return { pbo: used === total ? below / total : null, total, used, tied, discarded, droppedRows, block, K, distinct: D, merged: K - D, T, splits, histogram: { edges, counts } };
}

/** At most this many points in the IS/OOS scatter: the number of splits of the largest accepted S, without ties. */
export const SCATTER_MAX = MAX_COMBINATIONS;

/** The valid rows of the scatter, an evenly spaced subset when there are more than `max`, and their extent.
 *  With ties a split yields k rows (102,960 for 8 columns at S = 16): the extent is a loop, never Math.min(...),
 *  which overflowed the call stack (16/10). */
export function scatterView<T extends { isScore: number; oosScore: number; reason?: string }>(splits: T[], max = SCATTER_MAX) {
  const valid = splits.filter(s => !s.reason);
  let lo = Infinity, hi = -Infinity;
  for (const s of valid) {
    if (s.isScore < lo) lo = s.isScore; if (s.oosScore < lo) lo = s.oosScore;
    if (s.isScore > hi) hi = s.isScore; if (s.oosScore > hi) hi = s.oosScore;
  }
  const step = valid.length > max ? valid.length / max : 1;
  const points = step === 1 ? valid : Array.from({ length: max }, (_, i) => valid[Math.floor(i * step)]);
  return { points, total: valid.length, lo: valid.length ? lo : 0, hi: valid.length ? hi : 0 };
}

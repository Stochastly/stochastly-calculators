/** Browser CSCV. The Sortino branch follows the desktop app's CSCV (2026-10-03). */
export type Score = "sharpe" | "sortino";
export type CSCVInput = { matrix: number[][]; S: number; score: Score; embargo: number; ppy: number };
export type Split = { isBlocks: number[]; winner: number; isScore: number; oosScore: number; oosRank: number; omega: number; logit: number; reason?: string };
export type CSCVResult = { pbo: number | null; total: number; used: number; discarded: Record<string, number>; droppedRows: number; block: number; K: number; T: number; splits: Split[]; histogram: { edges: number[]; counts: number[] } };
export class CSCVError extends Error { field: string; constructor(field: string, message: string) { super(`${field}: ${message}`); this.field = field; } }
export const MAX_COMBINATIONS = 20000;
export const MAX_CELLS = 1000000;
export const CSCV_VERSION = "cscv-browser-1";

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

export function runCSCV(input: CSCVInput, progress?: (done: number, total: number) => void): CSCVResult {
  const { T, K, block, total } = validate(input);
  const { S, matrix, embargo, ppy } = input;
  const droppedRows = T % S;
  const scale = Array(K).fill(0) as number[];
  for (let t = 0; t < block * S; t++) for (let k = 0; k < K; k++) scale[k] = Math.max(scale[k], Math.abs(matrix[t][k]));
  const values = matrix.slice(0, block * S).map(row => row.map((v, k) => scale[k] > 0 ? v / scale[k] : 0));
  const full = Array.from({ length: S }, () => Array.from({ length: K }, emptyMoments));
  const trimmed = Array.from({ length: S }, () => Array.from({ length: K }, emptyMoments));
  for (let s = 0; s < S; s++) for (let t = 0; t < block; t++) for (let k = 0; k < K; k++) {
    const v = values[s * block + t][k];
    for (const m of t >= embargo ? [full[s][k], trimmed[s][k]] : [full[s][k]]) {
      m.sum += v; m.square += v * v; if (v < 0) { m.negativeSquare += v * v; m.negatives++; } m.n++;
    }
  }
  const splits: Split[] = [];
  const discarded: Record<string, number> = {};
  const edges = Array.from({ length: 33 }, (_, i) => -Math.max(3, Math.ceil(Math.log(K))) + i * 2 * Math.max(3, Math.ceil(Math.log(K))) / 32);
  const counts = Array(32).fill(0) as number[];
  const globalUndefined = input.score === "sortino" && (Array.from({ length: K }, (_, k) => values.every(row => row[k] >= 0)).some(Boolean) || values.every(row => row.every(v => v === row[0])));
  let below = 0, done = 0;
  for (const isBlocks of choose(S, S / 2)) {
    const selected = new Set(isBlocks);
    const isScores: number[] = [], oosScores: number[] = [];
    let reason = globalUndefined ? "global undefined Sortino ratio or identical configurations" : "";
    for (let k = 0; k < K && !globalUndefined; k++) {
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
    let winner = 0;
    if (!reason) {
      for (let k = 1; k < K; k++) if (isScores[k] > isScores[winner]) winner = k;
      if (isScores.filter(v => v === isScores[winner]).length !== 1) reason = "tied IS winner";
    }
    if (reason) {
      discarded[reason] = (discarded[reason] ?? 0) + 1;
      splits.push({ isBlocks, winner: -1, isScore: NaN, oosScore: NaN, oosRank: NaN, omega: NaN, logit: NaN, reason });
    } else {
      const winning = oosScores[winner];
      const rank = oosScores.filter(v => v < winning).length + 0.5 * (oosScores.filter(v => v === winning).length + 1);
      const omega = rank / (K + 1), logit = Math.log(omega / (1 - omega));
      if (logit < 0) below++;
      const bin = Math.min(31, Math.max(0, Math.floor((logit - edges[0]) / (edges[32] - edges[0]) * 32)));
      if (logit >= edges[0] && logit <= edges[32]) counts[bin]++;
      splits.push({ isBlocks, winner, isScore: isScores[winner], oosScore: winning, oosRank: rank, omega, logit });
    }
    done++;
    if (done % 64 === 0 || done === total) progress?.(done, total);
  }
  const used = total - Object.values(discarded).reduce((a, b) => a + b, 0);
  return { pbo: used === total ? below / total : null, total, used, discarded, droppedRows, block, K, T, splits, histogram: { edges, counts } };
}

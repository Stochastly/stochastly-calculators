/** First-passage simulator, formula version 2. Percentages refer to initial capital.
 * Mulberry32 (32-bit integer state) and Box-Muller normals make a seed replayable.
 * A trajectory draws its drift once when drift uncertainty is enabled. */
export type Inputs = {
  targetPct: number; dailyLossPct: number; totalLossPct: number;
  minDays: number; horizonDays: number | null; driftPct: number; volatilityPct: number;
  simulations: number; seed: number; driftSdPct: number;
  totalLossMode?: "static" | "trailing";
  trailingBase?: "close" | "check";
  trailingLock?: boolean;
  checksPerDay?: 1 | 4 | 24 | 96;
  evaluationFee?: number;
  resetFee?: number;
  currency?: string;
  /** Benchmark compatibility; the public calculator uses checksPerDay. */
  stepDays?: number;
};
export type Outcome = "pass" | "daily" | "total" | "censored";
export type Path = { outcome: Outcome; days: number; equity: number[] };
export type Interval = { low: number; high: number };
export type Summary = {
  counts: Record<Outcome, number>; proportions: Record<Outcome, number>;
  intervals: Record<Outcome, Interval>; passDays: { q1: number; median: number; q3: number } | null;
  examples: Path[]; rows: { path: number; outcome: Outcome; days: number }[];
};
export const MAX_STEPS = 4_000_000;
export const NO_HORIZON_CAP_DAYS = 1_000;
export const FORMULA_VERSION = 2;
const OUTCOMES: Outcome[] = ["pass", "daily", "total", "censored"];

export function validate(x: Inputs): void {
  const range = (name: keyof Inputs, low: number, high: number, integer = false) => {
    const v = x[name];
    if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high || (integer && !Number.isInteger(v)))
      throw new Error(`${name}: expected ${integer ? "integer " : ""}${low} to ${high}`);
  };
  range("targetPct", 0.01, 100);
  range("dailyLossPct", 0.01, 100);
  range("totalLossPct", 0.01, 100);
  range("minDays", 0, 1_000, true);
  if (x.horizonDays !== null) range("horizonDays", 1, 1_000, true);
  range("driftPct", -100, 100);
  range("volatilityPct", 0.001, 100);
  range("simulations", 20, 100_000, true);
  range("seed", 0, 0xffffffff, true);
  range("driftSdPct", 0, 100);
  if (x.totalLossMode !== undefined && !["static", "trailing"].includes(x.totalLossMode)) throw new Error("totalLossMode: expected static or trailing");
  if (x.trailingBase !== undefined && !["close", "check"].includes(x.trailingBase)) throw new Error("trailingBase: expected close or check");
  if (x.trailingLock !== undefined && typeof x.trailingLock !== "boolean") throw new Error("trailingLock: expected boolean");
  if (x.checksPerDay !== undefined && ![1, 4, 24, 96].includes(x.checksPerDay)) throw new Error("checksPerDay: expected 1, 4, 24 or 96");
  if (x.evaluationFee !== undefined) range("evaluationFee", 0, 1_000_000);
  if (x.resetFee !== undefined) range("resetFee", 0, 1_000_000);
  if (x.currency !== undefined && (typeof x.currency !== "string" || x.currency.length > 24 || /[\r\n,]/.test(x.currency))) throw new Error("currency: expected up to 24 characters without commas or line breaks");
  if (x.stepDays !== undefined) range("stepDays", 0.01, 1);
  if (x.stepDays !== undefined && x.checksPerDay !== undefined) throw new Error("stepDays: cannot combine with checksPerDay");
  const step = x.stepDays ?? 1 / (x.checksPerDay ?? 1);
  if (Math.abs(Math.round(1 / step) * step - 1) > 1e-9) throw new Error("stepDays: must divide one day");
  const days = x.horizonDays ?? NO_HORIZON_CAP_DAYS;
  if (x.simulations * days / step > MAX_STEPS)
    throw new Error(`simulation size: simulations × days × checks per day exceeds ${MAX_STEPS.toLocaleString("en-US")} steps`);
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(random: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}
export function wilson(successes: number, n: number): Interval {
  const z = 1.959963984540054;
  const p = successes / n, z2 = z * z, d = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / d;
  const half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / d;
  return { low: successes === 0 ? 0 : Math.max(0, center - half), high: successes === n ? 1 : Math.min(1, center + half) };
}
export function retryEstimate(passProbability: number, interval: Interval, fee: number, resetFee: number) {
  const transform = (p: number) => p > 0 ? { attempts: 1 / p, cost: fee + (1 / p - 1) * resetFee } : null;
  const estimate = transform(passProbability);
  return { estimate, attemptsInterval: interval.low > 0 && interval.high > 0 ? { low: 1 / interval.high, high: 1 / interval.low } : null,
    costInterval: interval.low > 0 && interval.high > 0 ? { low: transform(interval.high)!.cost, high: transform(interval.low)!.cost } : null };
}
function quantile(sorted: number[], p: number): number {
  const at = (sorted.length - 1) * p, i = Math.floor(at);
  return sorted[i] + (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (at - i);
}
/** Evaluate one fixed sequence of increments; also used by the seeded Monte Carlo engine. */
export function evaluatePath(x: Inputs, nextIncrement: (day: number, part: number) => number, maxDays = x.horizonDays ?? NO_HORIZON_CAP_DAYS): Path {
  const step = x.stepDays ?? 1 / (x.checksPerDay ?? 1), substeps = Math.round(1 / step);
  const intradayDailyCheck = x.checksPerDay !== undefined && x.checksPerDay > 1;
  let equity = 0, previousClose = 0, high = 0, outcome: Outcome = "censored", days = maxDays;
  const equityPath = [0];
  outer: for (let day = 1; day <= maxDays; day++) {
    for (let part = 1; part <= substeps; part++) {
      equity += nextIncrement(day, part);
      if (x.totalLossMode === "trailing" && (x.trailingBase === "check" || part === substeps)) high = Math.max(high, equity);
      const trailingFloor = high - x.totalLossPct;
      const floor = x.totalLossMode === "trailing" ? (x.trailingLock ? Math.min(0, trailingFloor) : trailingFloor) : -x.totalLossPct;
      if ((intradayDailyCheck || part === substeps) && equity - previousClose <= -x.dailyLossPct) { outcome = "daily"; days = day - 1 + part * step; break outer; }
      if (equity <= floor) { outcome = "total"; days = day - 1 + part * step; break outer; }
      if (equity >= x.targetPct && day - 1 + part * step >= x.minDays) { outcome = "pass"; days = day - 1 + part * step; break outer; }
    }
    previousClose = equity;
    equityPath.push(equity);
  }
  if (equityPath[equityPath.length - 1] !== equity) equityPath.push(equity);
  return { outcome, days, equity: equityPath };
}
export function simulate(x: Inputs, uncertain = false, progress?: (done: number) => void): Summary {
  validate(x);
  const random = mulberry32((x.seed ^ (uncertain ? 0x9e3779b9 : 0)) >>> 0);
  const counts = { pass: 0, daily: 0, total: 0, censored: 0 };
  const examples: Path[] = [], rows: Summary["rows"] = [], passDays: number[] = [];
  const step = x.stepDays ?? 1 / (x.checksPerDay ?? 1);
  for (let i = 0; i < x.simulations; i++) {
    const drift = x.driftPct + (uncertain ? x.driftSdPct * normal(random) : 0);
    const path = evaluatePath(x, () => drift * step + x.volatilityPct * Math.sqrt(step) * normal(random));
    const { outcome, days } = path;
    if (i < 20) examples.push(path);
    counts[outcome]++;
    rows.push({ path: i + 1, outcome, days });
    if (outcome === "pass") passDays.push(days);
    if ((i + 1) % 100 === 0 || i + 1 === x.simulations) progress?.(i + 1);
  }
  passDays.sort((a, b) => a - b);
  return {
    counts,
    proportions: Object.fromEntries(OUTCOMES.map(k => [k, counts[k] / x.simulations])) as Summary["proportions"],
    intervals: Object.fromEntries(OUTCOMES.map(k => [k, wilson(counts[k], x.simulations)])) as Summary["intervals"],
    passDays: passDays.length ? { q1: quantile(passDays, .25), median: quantile(passDays, .5), q3: quantile(passDays, .75) } : null,
    examples, rows,
  };
}

/** Exact two-barrier Brownian hitting probability for a continuous path. */
export function brownianPassProbability(a: number, b: number, mu: number, sigma: number): number {
  // 16/10 (review): a NaN drift came back as a NaN probability; every argument must be finite.
  if (![a, b, mu, sigma].every(Number.isFinite)) throw new Error("barriers, drift and sigma must be finite numbers");
  if (a <= 0 || b <= 0 || sigma <= 0) throw new Error("barriers and sigma must be positive");
  if (mu === 0) return b / (a + b);
  const k = 2 * mu / (sigma * sigma);
  if (k === 0) return b / (a + b);
  if (k > 0) return Math.expm1(-k * b) / Math.expm1(-k * (a + b));
  return Math.exp(k * a) * Math.expm1(k * b) / Math.expm1(k * (a + b));
}

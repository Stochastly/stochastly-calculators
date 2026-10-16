/** Annualized, deterministic cost illustration. Percent inputs are in percentage points. */
export interface CostInput {
  grossReturnPct: number;
  volatilityPct: number;
  roundTrips: number;
  exposure: number;
  venueRoundTurnBp: number;
  extraRtBp: number;
  stress: number;
}

export interface CostResult {
  composedBp: number;
  annualFrictionPct: number;
  netReturnPct: number;
  netSharpe: number;
  breakEvenBp: number | null;
  breakEvenTrips: number | null;
}

export const EXAMPLE: CostInput = {
  grossReturnPct: 12, volatilityPct: 18, roundTrips: 24, exposure: 1,
  venueRoundTurnBp: 2, extraRtBp: 1, stress: 1.5,
};

export class CostInputError extends Error {}

function bounded(name: string, value: number, min: number, max: number, positive = false): void {
  if (!Number.isFinite(value) || value < min || value > max || (positive && value === 0))
    throw new CostInputError(`${name} must be ${positive ? "above" : "at least"} ${min} and at most ${max}.`);
}

export function calculateCost(input: CostInput): CostResult {
  bounded("Gross annual return", input.grossReturnPct, -100, 1000);
  bounded("Annual volatility", input.volatilityPct, 0, 1000, true);
  bounded("Round trips per year", input.roundTrips, 0, 1e6);
  bounded("Average exposure", input.exposure, 0, 1e4);
  bounded("Venue round-turn cost", input.venueRoundTurnBp, 0, 1e5);
  bounded("Fees and slippage", input.extraRtBp, 0, 1e5);
  bounded("Stress multiplier", input.stress, 0, 1e4);
  // Parity with the desktop app's declared-cost model: add declared bp, multiply positive bp by nonnegative stress,
  // then convert bp to a fraction of notional. The annual model multiplies by trips and exposure.
  const composedBp = (input.venueRoundTurnBp + input.extraRtBp) * input.stress;
  const annualFrictionPct = input.roundTrips * input.exposure * composedBp / 100;
  const netReturnPct = input.grossReturnPct - annualFrictionPct;
  const netSharpe = netReturnPct / input.volatilityPct;
  const breakEvenBp = input.grossReturnPct >= 0 && input.roundTrips > 0 && input.exposure > 0 && input.stress > 0
    ? input.grossReturnPct * 100 / (input.roundTrips * input.exposure * input.stress) : null;
  const breakEvenTrips = input.grossReturnPct >= 0 && input.exposure > 0 && composedBp > 0
    ? input.grossReturnPct * 100 / (input.exposure * composedBp) : null;
  return { composedBp, annualFrictionPct, netReturnPct, netSharpe, breakEvenBp, breakEvenTrips };
}

export interface CostPoint { costBp: number; sharpe: number }
/** Horizontal axis: entered combined bp before stress. Volatility is held fixed. */
export function costCurve(input: CostInput): CostPoint[] {
  const result = calculateCost(input);
  const end = Math.max(10, (input.venueRoundTurnBp + input.extraRtBp) * 2, (result.breakEvenBp ?? 0) * 1.5);
  return Array.from({ length: 41 }, (_, i) => {
    const costBp = end * i / 40;
    return { costBp, sharpe: (input.grossReturnPct - input.roundTrips * input.exposure * costBp * input.stress / 100) / input.volatilityPct };
  });
}

const PARAMS = ["grossReturnPct", "volatilityPct", "roundTrips", "exposure", "venueRoundTurnBp", "extraRtBp", "stress"] as const;
const DECIMAL = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export function costQuery(input: CostInput): string {
  calculateCost(input);
  const query = new URLSearchParams({ v: "1" });
  for (const key of PARAMS) query.set(key, String(input[key]));
  return query.toString();
}

export function parseCostQuery(search: string): CostInput | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return null;
  if (raw.length > 2048) throw new CostInputError("The scenario URL is too long.");
  const query = new URLSearchParams(raw);
  const allowed = new Set(["v", ...PARAMS]);
  for (const key of query.keys()) if (!allowed.has(key) || query.getAll(key).length !== 1)
    throw new CostInputError(`Unknown or repeated scenario field: ${key}.`);
  if (query.get("v") !== "1") throw new CostInputError("The scenario URL needs method version 1.");
  const input = {} as CostInput;
  for (const key of PARAMS) {
    const value = query.get(key);
    if (value === null || !DECIMAL.test(value)) throw new CostInputError(`The scenario URL needs a numeric ${key}.`);
    input[key] = Number(value);
  }
  calculateCost(input);
  return input;
}

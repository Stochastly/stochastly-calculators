import { minTrl, perPeriod, psr, SharpeInputError, type MinTrlInput } from "./sharpe.ts";

export interface ExplorerInput {
  srAnnual: number;
  benchmarkAnnual: number;
  periodsPerYear: number;
  skew: number;
  kurtosis: number;
  confidence: number;
  observations?: number;
  sharpeFrom: number;
  sharpeTo: number;
  kurtosisFrom: number;
  kurtosisTo: number;
}

export interface CurvePoint { x: number; observations: number | null; years: number | null }

const PARAMS: Record<keyof ExplorerInput, string> = {
  srAnnual: "sr", benchmarkAnnual: "benchmark", periodsPerYear: "ppy", skew: "skew",
  kurtosis: "kurtosis", confidence: "confidence", observations: "t",
  sharpeFrom: "sr_from", sharpeTo: "sr_to", kurtosisFrom: "kurt_from", kurtosisTo: "kurt_to",
};

/** Scalar scenario URLs contain no return series. Unknown fields are refused. */
export function parseScenario(query: URLSearchParams): ExplorerInput {
  const allowed = new Set(["v", ...Object.values(PARAMS)]);
  for (const key of query.keys()) if (!allowed.has(key) || query.getAll(key).length !== 1)
    throw new SharpeInputError("scenario", `unknown or repeated scenario field: ${key}`);
  if (query.get("v") !== "1") throw new SharpeInputError("scenario", "scenario version must be 1");
  const input = {} as ExplorerInput;
  for (const [key, param] of Object.entries(PARAMS) as [keyof ExplorerInput, string][]) {
    const raw = query.get(param);
    if (key === "observations" && raw === null) continue;
    if (raw === null || raw.trim() === "") throw new SharpeInputError("scenario", `${param} is required`);
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new SharpeInputError("scenario", `${param} is outside the supported numeric range`);
    input[key] = value;
  }
  explorer(input);
  return input;
}

export function scenarioQuery(input: ExplorerInput): string {
  explorer(input);
  const query = new URLSearchParams({ v: "1" });
  for (const [key, param] of Object.entries(PARAMS) as [keyof ExplorerInput, string][]) {
    const value = input[key];
    if (value !== undefined) query.set(param, String(value));
  }
  return query.toString();
}

function finite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new SharpeInputError("non_finite", `${name} must be a finite number`);
}

export function explorer(input: ExplorerInput) {
  for (const [name, value] of Object.entries(input)) if (value !== undefined) finite(name, value);
  const { periodsPerYear: ppy, srAnnual, benchmarkAnnual, skew, kurtosis, confidence } = input;
  if (!(ppy > 0)) throw new SharpeInputError("ppy", "periods per year must be positive");
  if (!(input.sharpeFrom < input.sharpeTo)) throw new SharpeInputError("sharpe_range", "annual Sharpe range start must be below its end");
  if (!(input.kurtosisFrom < input.kurtosisTo)) throw new SharpeInputError("kurtosis_range", "kurtosis range start must be below its end");
  if (input.kurtosisFrom < 1 + skew * skew) throw new SharpeInputError("moments", "kurtosis range must start at or above 1 + skewness squared");
  const base: MinTrlInput = { sr: perPeriod(srAnnual, ppy), srStar: perPeriod(benchmarkAnnual, ppy), skew, kurtosis, confidence };
  // Validate moments and confidence even when SR <= SR*.
  let observations: number | null;
  try {
    const value = minTrl(base);
    observations = Number.isFinite(value) ? value : null;
  }
  catch (error) {
    if (error instanceof SharpeInputError && error.code === "sr_below") observations = null;
    else throw error;
  }
  const currentPsr = input.observations === undefined ? null : psr({ ...base, t: input.observations });
  const points = (from: number, to: number, value: (x: number) => MinTrlInput): CurvePoint[] =>
    Array.from({ length: 21 }, (_, index) => {
      const x = from + (to - from) * index / 20;
      try {
        const n = minTrl(value(x));
        return { x, observations: Number.isFinite(n) ? n : null, years: Number.isFinite(n) ? n / ppy : null };
      } catch (error) {
        if (error instanceof SharpeInputError && error.code === "sr_below") return { x, observations: null, years: null };
        throw error;
      }
    });
  return {
    observations,
    years: observations === null ? null : observations / ppy,
    currentPsr,
    sharpeCurve: points(input.sharpeFrom, input.sharpeTo, x => ({ ...base, sr: perPeriod(x, ppy) })),
    kurtosisCurve: points(input.kurtosisFrom, input.kurtosisTo, x => ({ ...base, kurtosis: x })),
  };
}

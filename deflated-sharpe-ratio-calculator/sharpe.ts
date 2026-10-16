/**
 * Probabilistic Sharpe ratio (PSR), minimum track record length (MinTRL) and deflated Sharpe
 * ratio (DSR), computed in the browser for /tools/deflated-sharpe-ratio-calculator.
 *
 * Sources, read at the source on 03/10/2026:
 * - Bailey, D. H. and Lopez de Prado, M. (2012). The Sharpe Ratio Efficient Frontier.
 *   Journal of Risk 15(2). doi:10.21314/JOR.2012.255. PSR: Eq. (11). MinTRL: Eq. (13).
 * - Bailey, D. H. and Lopez de Prado, M. (2014). The Deflated Sharpe Ratio: Correcting for
 *   Selection Bias, Backtest Overfitting and Non-Normality. Journal of Portfolio Management 40(5).
 *   doi:10.3905/jpm.2014.40.5.094. DSR: Eq. (2) and the definition of SR0 below it (SSRN 2460551,
 *   version of July 31, 2014, p. 8).
 *
 * Units: every Sharpe ratio here is PER PERIOD (mean over standard deviation of one observation),
 * never annualized. V is the variance of the trials' per-period Sharpe ratios. Kurtosis is
 * NON-EXCESS (normal = 3). The papers write it the same way.
 *
 * Accuracy, measured by the tests against Python 3.12 `math.erfc` and
 * `statistics.NormalDist.inv_cdf`:
 * - normCdf: Hart (1968) algorithm 5666 in the double-precision form published by West (2005),
 *   "Better approximations to cumulative normal functions", Wilmott Magazine. Measured over
 *   x = -37 to 37 by steps of 0.01: absolute error at most 2.2e-16; relative error in the lower
 *   tail at most 8.9e-9 (near x = -7.8). Below x = -37 it returns 0, an absolute error under 1e-300.
 * - normInv: Wichura (1988), algorithm AS241 PPND16, the coefficients of CPython's
 *   `statistics._normal_dist_inv_cdf`. Relative error about 1e-16 for 1e-300 < p < 1 - 1e-16.
 *   The coefficients are written in their shortest round-trip double form (ESLint
 *   no-loss-of-precision): each literal is the same double as CPython's 20-digit literal.
 */

export const EULER_MASCHERONI = 0.5772156649015329;

/**
 * The version of the method behind every figure the calculator prints, carried as `v` by a shared
 * link and printed with the results. Version 1 pins: PSR, Eq. (11)
 * of the 2012 paper; MinTRL, Eq. (13); DSR = PSR(SR0), Eq. (2) of the 2014 paper, with SR0 as
 * defined under it and SR0 = 0 for N = 1; V = 1/T when V is left empty (`nullVariance`); the
 * bounds of a shared link. A change to any of them takes a new number: a link written under one
 * version is refused by another, never read with a method its sender did not use.
 */
export const ALGORITHM_VERSION = 1;

/** An input outside the domain of a formula. `code` lets the page show its own sentence. */
export class SharpeInputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SharpeInputError";
    this.code = code;
  }
}

function fini(nom: string, x: number): void {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new SharpeInputError("non_finite", `${nom} must be a finite number`);
}

/** Standard normal cumulative distribution function. */
export function normCdf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const a = Math.abs(x);
  let p: number;
  if (a > 37) {
    p = 0;
  } else {
    const e = Math.exp(-a * a / 2);
    if (a < 7.07106781186547) {
      let n = 0.0352624965998911 * a + 0.700383064443688;
      n = n * a + 6.37396220353165;
      n = n * a + 33.912866078383;
      n = n * a + 112.079291497871;
      n = n * a + 221.213596169931;
      n = n * a + 220.206867912376;
      let d = 0.0883883476483184 * a + 1.75566716318264;
      d = d * a + 16.064177579207;
      d = d * a + 86.7807322029461;
      d = d * a + 296.564248779674;
      d = d * a + 637.333633378831;
      d = d * a + 793.826512519948;
      d = d * a + 440.413735824752;
      p = e * n / d;
    } else {
      const f = a + 1 / (a + 2 / (a + 3 / (a + 4 / (a + 0.65))));
      p = e / f / 2.506628274631;
    }
  }
  return x > 0 ? 1 - p : p;
}

/** Inverse of the standard normal CDF, for 0 < p < 1 (AS241 PPND16). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new SharpeInputError("probability", "the probability must lie between 0 and 1");
  }
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    const num = (((((((2509.0809287301227 * r +
      33430.57558358813) * r +
      67265.7709270087) * r +
      45921.95393154987) * r +
      13731.69376550946) * r +
      1971.5909503065513) * r +
      133.14166789178438) * r +
      3.3871328727963665) * q;
    const den = (((((((5226.495278852854 * r +
      28729.085735721943) * r +
      39307.89580009271) * r +
      21213.794301586597) * r +
      5394.196021424751) * r +
      687.1870074920579) * r +
      42.31333070160091) * r +
      1.0);
    return num / den;
  }
  let r = q <= 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let num: number;
  let den: number;
  if (r <= 5) {
    r -= 1.6;
    num = (((((((0.0007745450142783414 * r +
      0.022723844989269184) * r +
      0.2417807251774506) * r +
      1.2704582524523684) * r +
      3.6478483247632045) * r +
      5.769497221460691) * r +
      4.630337846156546) * r +
      1.4234371107496835);
    den = (((((((1.0507500716444169e-9 * r +
      0.0005475938084995345) * r +
      0.015198666563616457) * r +
      0.14810397642748008) * r +
      0.6897673349851) * r +
      1.6763848301838038) * r +
      2.053191626637759) * r +
      1.0);
  } else {
    r -= 5;
    num = (((((((2.0103343992922881e-7 * r +
      0.000027115555687434876) * r +
      0.0012426609473880784) * r +
      0.026532189526576124) * r +
      0.29656057182850487) * r +
      1.7848265399172913) * r +
      5.463784911164114) * r +
      6.657904643501103);
    den = (((((((2.0442631033899397e-15 * r +
      1.421511758316446e-7) * r +
      0.000018463183175100548) * r +
      0.0007868691311456133) * r +
      0.014875361290850615) * r +
      0.1369298809227358) * r +
      0.599832206555888) * r +
      1.0);
  }
  const x = num / den;
  return q < 0 ? -x : x;
}

/**
 * 1 - skew * SR + (kurtosis - 1) / 4 * SR^2: the variance factor of the Sharpe estimator
 * (Mertens 2002), the square of the PSR denominator. Refuses moments no distribution can have
 * (kurtosis below 1 + skew^2, the usual sign of an EXCESS kurtosis typed as raw) and a factor
 * that is not positive, where the formula has no meaning.
 */
export function sharpeVarianceFactor(sr: number, skew: number, kurtosis: number): number {
  fini("SR", sr);
  fini("skewness", skew);
  fini("kurtosis", kurtosis);
  if (kurtosis < 1 + skew * skew) {
    throw new SharpeInputError("moments", "kurtosis must be at least 1 + skewness squared; normal returns have kurtosis 3, an excess kurtosis of 0");
  }
  const v = 1 - skew * sr + (kurtosis - 1) / 4 * sr * sr;
  if (!(v > 0)) {
    throw new SharpeInputError("denominator", "1 - skewness * SR + (kurtosis - 1) / 4 * SR^2 must be positive; the formula does not apply to these moments");
  }
  return v;
}

export interface PsrInput { sr: number; srStar: number; t: number; skew: number; kurtosis: number }

/** PSR(SR*), Bailey and Lopez de Prado (2012) Eq. (11). T may be fractional (MinTRL is). */
export function psr({ sr, srStar, t, skew, kurtosis }: PsrInput): number {
  fini("SR*", srStar);
  fini("T", t);
  if (t < 2) throw new SharpeInputError("t", "T must be at least 2 observations");
  const v = sharpeVarianceFactor(sr, skew, kurtosis);
  const z = (sr - srStar) * Math.sqrt(t - 1) / Math.sqrt(v);
  // 16/10 (review): finite inputs can overflow (SR = 1e200: infinity over infinity) and gave NaN.
  if (Number.isNaN(z)) throw new SharpeInputError("non_finite", "these inputs overflow double precision; the PSR is not computable");
  return normCdf(z);
}

export interface MinTrlInput { sr: number; srStar: number; skew: number; kurtosis: number; confidence: number }

/**
 * MinTRL, Bailey and Lopez de Prado (2012) Eq. (13), in observations, NOT rounded (the paper
 * prints 59.895). The smallest whole track record is `Math.ceil` of it.
 */
export function minTrl({ sr, srStar, skew, kurtosis, confidence }: MinTrlInput): number {
  fini("SR*", srStar);
  fini("confidence", confidence);
  if (!(confidence > 0.5 && confidence < 1)) throw new SharpeInputError("confidence", "the confidence level must lie strictly between 0.5 and 1");
  const v = sharpeVarianceFactor(sr, skew, kurtosis);
  if (!(sr > srStar)) throw new SharpeInputError("sr_below", "MinTRL exists only when SR exceeds SR*; no track record length reaches the confidence level otherwise");
  const z = normInv(confidence) / (sr - srStar);
  return 1 + v * z * z;
}

/** N, the declared number of trials: a whole number, at least 1. */
export function trialCount(nTrials: number): number {
  fini("N", nTrials);
  if (!Number.isInteger(nTrials) || nTrials < 1) throw new SharpeInputError("n", "N must be a whole number of trials, at least 1");
  return nTrials;
}

/**
 * V when the user leaves it empty: 1/T. Under the null of the DSR (every trial without skill,
 * true Sharpe ratio 0) and returns independent from one period to the next, the variance of a
 * Sharpe ratio estimated on T returns is asymptotically the variance factor at SR = 0 divided by T, and that
 * factor is 1 whatever the skewness and kurtosis (`sharpeVarianceFactor(0, skew, kurtosis)`).
 * It is a large-sample value, and it ignores any dispersion of true skill between trials.
 * The desktop app's DSR deflates with the same V (checked by the tests).
 */
export function nullVariance(t: number): number {
  fini("T", t);
  if (t < 2) throw new SharpeInputError("t", "T must be at least 2 observations");
  return 1 / t;
}

/** The V the DSR uses: the entered one, or `nullVariance(t)` when none is entered (null). */
export function resolveVariance(variance: number | null, t: number): number {
  if (variance === null) return nullVariance(t);
  fini("V", variance);
  if (variance < 0) throw new SharpeInputError("variance", "V, the variance of the trials' Sharpe ratios, cannot be negative");
  return variance;
}

/** The longest declaration of how N was counted, in code points. */
export const N_SOURCE_MAX = 120;

/** Control characters (C0, DEL, C1) and the Unicode bidirectional controls: they can reorder or hide
 *  the text around them once displayed, and a shared link carries this text to another reader. */
function caractereRefuse(cp: number): boolean {
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || cp === 0x061c || cp === 0x200e || cp === 0x200f
    || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || (cp >= 0xd800 && cp <= 0xdfff);
}

/**
 * How N was counted, as the user declares it: free text, trimmed, at most N_SOURCE_MAX code points,
 * without control or bidirectional characters. "" means not stated. The page writes it with
 * textContent, never as HTML.
 */
export function declaredSource(text: string): string {
  if (typeof text !== "string") throw new SharpeInputError("nsrc", "the description of how N was counted must be text");
  const t = text.trim();
  const points = [...t];
  if (points.length > N_SOURCE_MAX) throw new SharpeInputError("nsrc", `the description of how N was counted is limited to ${N_SOURCE_MAX} characters`);
  if (points.some(c => caractereRefuse(c.codePointAt(0) ?? 0))) {
    throw new SharpeInputError("nsrc", "the description of how N was counted cannot contain control or text-direction characters");
  }
  return t;
}

/**
 * SR0, the expected maximum Sharpe ratio of N independent unskilled trials whose Sharpe ratios
 * have variance V (DSR paper, definition under Eq. (2)). One trial selects nothing: SR0 = 0,
 * the expected value of a single unskilled draw.
 */
export function expectedMaxSharpe(nTrials: number, variance: number): number {
  trialCount(nTrials);
  fini("V", variance);
  if (variance < 0) throw new SharpeInputError("variance", "V, the variance of the trials' Sharpe ratios, cannot be negative");
  if (nTrials === 1) return 0;
  const sr0 = Math.sqrt(variance) * (-(1 - EULER_MASCHERONI) * normInv(1 / nTrials)
    - EULER_MASCHERONI * normInv(1 / (nTrials * Math.E)));
  // 16/10 (review): N near 1e308 underflows 1/(N e) and gave NaN without a word.
  if (!Number.isFinite(sr0)) throw new SharpeInputError("n", "N is too large for double precision");
  return sr0;
}

/**
 * sigma_SR = sqrt(V), the standard deviation of the trials' per-period Sharpe ratios. SR0 scales
 * with it, so the page prints it next to the assumed V.
 */
export function sigmaSr(variance: number): number {
  fini("V", variance);
  if (variance < 0) throw new SharpeInputError("variance", "V, the variance of the trials' Sharpe ratios, cannot be negative");
  return Math.sqrt(variance);
}

export interface DsrInput { sr: number; t: number; skew: number; kurtosis: number; nTrials: number; variance: number }

/** DSR = PSR(SR0), Bailey and Lopez de Prado (2014) Eq. (2). */
export function dsr(input: DsrInput): { sr0: number; dsr: number } {
  const sr0 = expectedMaxSharpe(input.nTrials, input.variance);
  return { sr0, dsr: psr({ sr: input.sr, srStar: sr0, t: input.t, skew: input.skew, kurtosis: input.kurtosis }) };
}

/** Annual Sharpe ratio from a per-period one, under independent returns: SR * sqrt(periods). */
export function annualize(srPerPeriod: number, periodsPerYear: number): number {
  fini("SR", srPerPeriod);
  fini("periods per year", periodsPerYear);
  if (!(periodsPerYear > 0)) throw new SharpeInputError("ppy", "periods per year must be positive");
  return srPerPeriod * Math.sqrt(periodsPerYear);
}

/** Per-period Sharpe ratio from an annual one, under independent returns: SR / sqrt(periods). */
export function perPeriod(srAnnual: number, periodsPerYear: number): number {
  fini("SR", srAnnual);
  fini("periods per year", periodsPerYear);
  if (!(periodsPerYear > 0)) throw new SharpeInputError("ppy", "periods per year must be positive");
  return srAnnual / Math.sqrt(periodsPerYear);
}

export interface CalculatorInput {
  sr: number; t: number; skew: number; kurtosis: number; srStar: number; confidence: number;
  nTrials: number;
  /** V; null when the user leaves it empty, and the DSR then uses `nullVariance(t)` = 1/T. */
  variance: number | null;
  periodsPerYear: number;
  /** How N was counted, as declared by the user; "" when not stated. */
  nSource: string;
}

/** Where the V of the DSR comes from: typed by the user, or 1/T under the null (`nullVariance`). */
export type VarianceSource = "entered" | "null_iid";

export interface CalculatorOutput {
  psr: number | null; minTrl: number | null; minTrlYears: number | null; sr0: number | null; dsr: number | null;
  srAnnual: number | null; sigmaSr: number | null; sigmaSrAnnual: number | null;
  /** The V the DSR used, and its source. */
  variance: number | null; varianceSource: VarianceSource;
  /** The declared N once checked, and the declaration of how it was counted once checked. */
  nTrials: number | null; nSource: string | null;
  errors: { field: string; code: string; message: string }[];
}

/**
 * Everything the page shows, each figure computed independently: an input that blocks MinTRL
 * (SR below SR*) does not hide the PSR, and a bad N does not hide the PSR either.
 */
export function calculate(x: CalculatorInput): CalculatorOutput {
  const out: CalculatorOutput = {
    psr: null, minTrl: null, minTrlYears: null, sr0: null, dsr: null, srAnnual: null, sigmaSr: null, sigmaSrAnnual: null,
    variance: null, varianceSource: x.variance === null ? "null_iid" : "entered", nTrials: null, nSource: null, errors: [],
  };
  const essai = <T,>(field: string, f: () => T): T | null => {
    try {
      return f();
    } catch (e) {
      if (e instanceof SharpeInputError) {
        if (!out.errors.some(err => err.code === e.code)) out.errors.push({ field, code: e.code, message: e.message });
        return null;
      }
      throw e;
    }
  };
  out.psr = essai("psr", () => psr(x));
  out.minTrl = essai("mintrl", () => minTrl(x));
  out.srAnnual = essai("annual", () => annualize(x.sr, x.periodsPerYear));
  if (out.minTrl !== null && out.srAnnual !== null) out.minTrlYears = out.minTrl / x.periodsPerYear;
  const v = essai("variance", () => resolveVariance(x.variance, x.t));
  out.variance = v;
  if (v !== null) out.sigmaSr = essai("sigma", () => sigmaSr(v));
  if (out.sigmaSr !== null && out.srAnnual !== null) out.sigmaSrAnnual = out.sigmaSr * Math.sqrt(x.periodsPerYear);
  out.nTrials = essai("n", () => trialCount(x.nTrials));
  if (v !== null && out.nTrials !== null) {
    const d = essai("dsr", () => dsr({ ...x, variance: v }));
    if (d) { out.sr0 = d.sr0; out.dsr = d.dsr; }
  }
  out.nSource = essai("nsrc", () => declaredSource(x.nSource));
  return out;
}

/** Every code `calculate` can report. The page carries one sentence per code (`data-erreur`). */
export const ERROR_CODES = ["non_finite", "t", "moments", "denominator", "confidence", "sr_below", "n", "variance", "ppy", "nsrc"] as const;

/** The ids of the page's inputs, one per field of `CalculatorInput`. */
export const INPUT_IDS: Record<keyof CalculatorInput, string> = {
  sr: "dsr-sr", t: "dsr-t", skew: "dsr-skew", kurtosis: "dsr-kurt", periodsPerYear: "dsr-ppy",
  srStar: "dsr-srstar", confidence: "dsr-conf", nTrials: "dsr-n", variance: "dsr-v", nSource: "dsr-nsrc",
};

/** What the page reads from one field: the browser's `value`, `valueAsNumber` and `validity.badInput`. */
export interface FieldReading { value: string; valueAsNumber: number; badInput: boolean }

/**
 * The calculator's input from the page's fields, read through `read(id)` (null for a missing field).
 * An EMPTY V field is null, the null dispersion 1/T; a V field holding text the browser cannot parse
 * (`badInput`) is NaN, refused as non_finite, never taken for an empty one. Any other empty number
 * is NaN as well.
 */
export function readInput(read: (id: string) => FieldReading | null): CalculatorInput {
  const nombre = (k: keyof CalculatorInput) => read(INPUT_IDS[k])?.valueAsNumber ?? NaN;
  const champV = read(INPUT_IDS.variance);
  return {
    sr: nombre("sr"), t: nombre("t"), skew: nombre("skew"), kurtosis: nombre("kurtosis"),
    srStar: nombre("srStar"), confidence: nombre("confidence"), nTrials: nombre("nTrials"),
    variance: champV && champV.value.trim() === "" && !champV.badInput ? null : (champV?.valueAsNumber ?? NaN),
    periodsPerYear: nombre("periodsPerYear"),
    nSource: read(INPUT_IDS.nSource)?.value ?? "",
  };
}

export const NOT_DEFINED = "not defined";
export const NOT_STATED = "not stated";
export const N_ONE_NOTE = "PSR only; no trial-count deflation.";

/** V as the notes print it: four significant digits, no trailing zeros. */
export function formatVariance(v: number): string {
  return String(Number(v.toPrecision(4)));
}

/** The sentence that says which V the DSR used, and under which assumption when none was entered. */
function noteVariance(o: CalculatorOutput): string {
  if (o.variance === null) return NOT_DEFINED;
  if (o.varianceSource === "entered") return `Null dispersion from the entered V: ${formatVariance(o.variance)} per period.`;
  return `Null dispersion estimated under independent returns and a true Sharpe ratio of 0 in each trial: V = 1/T = ${formatVariance(o.variance)} per period.`;
}

/** The sentence that says how N enters the result. N = 1 selects nothing: the DSR is the PSR at 0. */
function noteTrials(o: CalculatorOutput): string {
  if (o.nTrials === null) return NOT_DEFINED;
  if (o.nTrials === 1) return N_ONE_NOTE;
  if (o.variance === 0) return `N = ${o.nTrials} declared trials; with V = 0, SR0 = 0 and no deflation applies.`;
  return `Deflated for N = ${o.nTrials} declared trials.`;
}

/**
 * A probability as the page prints it: four decimals; six when four would round to 0 or 1;
 * a bound beyond that. "1.0000" would read as certainty, which a normal CDF never reaches.
 */
export function formatProbability(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return NOT_DEFINED;
  const q = p.toFixed(4);
  if (q !== "1.0000" && q !== "0.0000") return q;
  const r = p.toFixed(6);
  if (r === "1.000000") return "> 0.999999";
  if (r === "0.000000") return "< 0.000001";
  return r;
}

function fixe(x: number | null, decimales: number): string {
  return x === null || !Number.isFinite(x) ? NOT_DEFINED : x.toFixed(decimales);
}

/** The text of each `<output>` of the page, keyed by its id. The server HTML carries the same strings. */
export function formatOutputs(o: CalculatorOutput): Record<string, string> {
  return {
    "dsr-out-annual": fixe(o.srAnnual, 4),
    "dsr-out-psr": formatProbability(o.psr),
    "dsr-out-mintrl": fixe(o.minTrl, 2),
    "dsr-out-mintrl-ceil": o.minTrl === null || !Number.isFinite(o.minTrl) ? NOT_DEFINED : String(Math.ceil(o.minTrl)),
    "dsr-out-mintrl-years": fixe(o.minTrlYears, 2),
    "dsr-out-sigma": fixe(o.sigmaSr, 4),
    "dsr-out-sigma-annual": fixe(o.sigmaSrAnnual, 4),
    "dsr-out-sr0": fixe(o.sr0, 4),
    "dsr-out-dsr": formatProbability(o.dsr),
    "dsr-out-v-note": noteVariance(o),
    "dsr-out-n-note": noteTrials(o),
    "dsr-out-nsrc": o.nSource === null ? NOT_DEFINED : o.nSource === "" ? NOT_STATED : o.nSource,
    "dsr-out-version": String(ALGORITHM_VERSION),
  };
}

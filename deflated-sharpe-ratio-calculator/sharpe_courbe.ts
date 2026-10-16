/**
 * The sensitivity of the DSR to N on /tools/deflated-sharpe-ratio-calculator (03/10): the DSR of
 * the entered track record for every N from 1 to N_MAX on a log scale, with the entered N marked.
 * Three readings of the same points: an SVG figure (monochrome, `currentColor`, with a title and a
 * text description), a table at N = 1, 2, 5, 10, 20, 50... and a CSV of every computed point.
 *
 * Each point is `dsr()` of sharpe.ts with the entered SR, T, skewness, kurtosis and V
 * (V empty: `nullVariance(t)`, as the calculator does). Only N changes along the curve. SR0 rises with
 * N for V > 0 and the PSR falls as its benchmark rises, so the curve does not rise
 * (the tests check it point by point).
 *
 * `courbeHtml` returns HTML text. Every string in it is a number this file formats or a constant
 * sentence: no text typed by the user (the declared source of N) enters it, so the page can set it
 * with innerHTML. The page's server HTML is `courbePartial` of the default inputs, written at build
 * time and compared by test.
 */
import { dsr, formatProbability, resolveVariance, SharpeInputError, trialCount, type CalculatorInput } from "./sharpe.ts";

/** The right end of the axis: 10,000, or the next power of ten at or above the entered N. */
export const N_AXE_MIN = 10_000;
/** The axis stops here; a larger N is computed in the results but not drawn. */
export const N_AXE_PLAFOND = 1_000_000_000;
/** Log-spaced steps between N = 1 and the right end, before rounding to whole N. */
export const PAS_LOG = 120;

export interface PointCourbe { n: number; sr0: number; dsr: number }

export interface Courbe {
  nMax: number;
  /** Increasing N, each once, from 1 to nMax: the log grid, the rows of the table, and the entered N when it lies within. */
  points: PointCourbe[];
  /** The entered N, when it is a valid N within the axis. */
  courant: PointCourbe | null;
  /** The V of every point. */
  variance: number;
}

/** The right end of the axis for an entered N (NaN or invalid: 10,000). */
export function nMaxPour(n: number): number {
  let m = N_AXE_MIN;
  while (Number.isFinite(n) && m < n && m < N_AXE_PLAFOND) m *= 10;
  return m;
}

/** Whole N from 1 to nMax, log-spaced, each once, in increasing order; nMax is the last one. */
export function grilleN(nMax: number, pas: number = PAS_LOG): number[] {
  const l = Math.log10(nMax);
  const vus = new Set<number>([1, nMax]);
  for (let i = 1; i < pas; i++) vus.add(Math.round(10 ** (l * i / pas)));
  return [...vus].sort((a, b) => a - b);
}

/** N = 1, 2, 5, 10, 20, 50... up to nMax: the rows of the table. */
export function grilleTable(nMax: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= nMax; d *= 10) for (const k of [1, 2, 5]) if (k * d <= nMax) out.push(k * d);
  return out;
}

/**
 * The curve for these inputs, or null when the DSR is not defined for them (a bad T, moments
 * outside their domain, a bad V): the results above already say which input is at fault.
 */
export function courbe(input: CalculatorInput): Courbe | null {
  try {
    const variance = resolveVariance(input.variance, input.t);
    let n: number | null = null;
    try {
      n = trialCount(input.nTrials);
    } catch (e) {
      if (!(e instanceof SharpeInputError)) throw e;
    }
    const nMax = nMaxPour(n ?? NaN);
    // The log grid, plus the rows of the table (1, 2, 5, 10... are not all on it: it holds 501, 1,995
    // and 5,012), plus the entered N. 03/10: without the table rows, the table skipped 500, 2,000 and
    // 5,000 silently (caught by the tests).
    const tous = new Set([...grilleN(nMax), ...grilleTable(nMax)]);
    if (n !== null && n <= nMax) tous.add(n);
    const grille = [...tous].sort((a, b) => a - b);
    const points = grille.map(k => ({ n: k, ...dsr({ sr: input.sr, t: input.t, skew: input.skew, kurtosis: input.kurtosis, nTrials: k, variance }) }));
    const courant = n === null ? null : points.find(p => p.n === n) ?? null;
    return { nMax, points, courant, variance };
  } catch (e) {
    if (e instanceof SharpeInputError) return null;
    throw e;
  }
}

/** A whole N with thousands separators: 10000 -> "10,000". */
export function formatN(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** An axis label: 1, 10, 100, 1k, 10k, 100k, 1M... 1B. */
function etiquetteN(n: number): string {
  if (n >= 1e9) return `${n / 1e9}B`;
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}k`;
  return String(n);
}

const LARGEUR = 640;
const HAUTEUR = 300;
const GAUCHE = 56;
const DROITE = 16;
const HAUT = 16;
const BAS = 44;

const r2 = (x: number) => String(Math.round(x * 100) / 100);

/** A probability as HTML text. formatProbability writes "< 0.000001" and "> 0.999999" at the extremes:
 *  03/10, that `<` went raw into the table and the text (caught by the tests). */
const probaHtml = (p: number) => formatProbability(p).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(c: Courbe): string {
  const largeur = LARGEUR - GAUCHE - DROITE;
  const hauteur = HAUTEUR - HAUT - BAS;
  const lMax = Math.log10(c.nMax);
  const x = (n: number) => GAUCHE + Math.log10(n) / lMax * largeur;
  const y = (p: number) => HAUT + (1 - p) * hauteur;
  const parts: string[] = [];
  parts.push(`<svg class="dsr-courbe-svg" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" role="img" aria-labelledby="dsr-courbe-titre" aria-describedby="dsr-courbe-texte" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(`<title id="dsr-courbe-titre">DSR against the number of trials N, from 1 to ${formatN(c.nMax)}, log scale</title>`);
  parts.push(`<g stroke="currentColor" stroke-width="1" stroke-opacity="0.2" fill="none">`);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) parts.push(`<line x1="${GAUCHE}" y1="${r2(y(p))}" x2="${LARGEUR - DROITE}" y2="${r2(y(p))}"/>`);
  for (let d = 1; d <= c.nMax; d *= 10) parts.push(`<line x1="${r2(x(d))}" y1="${HAUT}" x2="${r2(x(d))}" y2="${HAUTEUR - BAS}"/>`);
  parts.push(`</g>`);
  parts.push(`<g fill="currentColor" font-size="12">`);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) parts.push(`<text x="${GAUCHE - 8}" y="${r2(y(p) + 4)}" text-anchor="end">${p}</text>`);
  for (let d = 1; d <= c.nMax; d *= 10) parts.push(`<text x="${r2(x(d))}" y="${HAUTEUR - BAS + 18}" text-anchor="middle">${etiquetteN(d)}</text>`);
  parts.push(`<text x="${r2(GAUCHE + largeur / 2)}" y="${HAUTEUR - 6}" text-anchor="middle">Number of trials N, log scale</text>`);
  parts.push(`<text x="14" y="${r2(HAUT + hauteur / 2)}" text-anchor="middle" transform="rotate(-90 14 ${r2(HAUT + hauteur / 2)})">DSR</text>`);
  parts.push(`</g>`);
  const d = c.points.map((p, i) => `${i === 0 ? "M" : "L"}${r2(x(p.n))} ${r2(y(p.dsr))}`).join(" ");
  parts.push(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/>`);
  if (c.courant) {
    const cx = r2(x(c.courant.n));
    const cy = r2(y(c.courant.dsr));
    parts.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="currentColor"/><circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

function texte(c: Courbe, input: CalculatorInput): string {
  const premier = c.points[0];
  const dernier = c.points[c.points.length - 1];
  const debut = `With the inputs above and V = ${String(Number(c.variance.toPrecision(4)))} per period, the DSR is ${probaHtml(premier.dsr)} at N = 1`;
  const milieu = c.courant && c.courant.n !== 1 && c.courant.n !== c.nMax
    ? `, ${probaHtml(c.courant.dsr)} at the entered N = ${formatN(c.courant.n)} (the marked point)`
    : "";
  const fin = `, and ${probaHtml(dernier.dsr)} at N = ${formatN(c.nMax)}.`;
  let hors = "";
  if (!c.courant) {
    hors = Number.isInteger(input.nTrials) && input.nTrials > c.nMax
      ? ` The entered N lies beyond ${formatN(c.nMax)}, the right end of the axis, and is not marked.`
      : " The entered N is not a valid number of trials, so no point is marked.";
  }
  const pente = c.variance === 0
    ? " With V = 0, SR0 is 0 for every N and the curve is flat."
    : " SR0 rises with N, so the DSR falls as N grows.";
  return `<p class="v2-p" id="dsr-courbe-texte">${debut}${milieu}${fin}${hors}${pente}</p>`;
}

function table(c: Courbe): string {
  const lignes = grilleTable(c.nMax);
  const courant = c.courant;
  if (courant && !lignes.includes(courant.n)) {
    lignes.push(courant.n);
    lignes.sort((a, b) => a - b);
  }
  const parN = new Map(c.points.map(p => [p.n, p]));
  const corps = lignes.map(n => {
    const p = parN.get(n);
    // `courbe` computes every row of the table: a missing one is a fault of this file, never a row to skip.
    if (!p) throw new Error(`sharpe_courbe: N = ${n} is a row of the table and not a point of the curve`);
    const marque = courant && courant.n === n ? " (entered)" : "";
    return `<tr${marque ? ' class="dsr-courbe-courant"' : ""}><th scope="row">${formatN(n)}${marque}</th><td>${p.sr0.toFixed(4)}</td><td>${probaHtml(p.dsr)}</td></tr>`;
  }).join("");
  return `<table class="dsr-courbe-table"><caption>DSR at selected N, with the other inputs fixed</caption>`
    + `<thead><tr><th scope="col">N</th><th scope="col">SR0 per period</th><th scope="col">DSR</th></tr></thead>`
    + `<tbody>${corps}</tbody></table>`;
}

/** The CSV of every point of the curve: N, SR0 per period and DSR, ten significant digits. */
export function courbeCsv(c: Courbe): string {
  const nombre = (v: number) => String(Number(v.toPrecision(10)));
  return ["N,SR0 per period,DSR", ...c.points.map(p => `${p.n},${nombre(p.sr0)},${nombre(p.dsr)}`)].join("\r\n") + "\r\n";
}

function lienCsv(c: Courbe): string {
  return `<p class="v2-p"><a class="dsr-courbe-csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(courbeCsv(c))}" download="dsr-sensitivity.csv">Download the ${c.points.length} points of the curve as CSV</a></p>`;
}

/** The content of #dsr-courbe for these inputs. */
export function courbeHtml(input: CalculatorInput): string {
  const c = courbe(input);
  if (!c) return `<p class="v2-p" id="dsr-courbe-texte">The DSR is not defined for the inputs above, so the curve is not drawn.</p>`;
  return `<figure class="dsr-courbe-figure">${svg(c)}</figure>${texte(c, input)}${table(c)}${lienCsv(c)}`;
}

/** The server HTML of the curve: the #dsr-courbe block the page includes ({{include:dsr-courbe}}). */
export function courbePartial(input: CalculatorInput): string {
  return `<div id="dsr-courbe" class="dsr-courbe">${courbeHtml(input)}</div>\n`;
}

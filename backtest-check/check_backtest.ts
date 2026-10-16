/**
 * /check: read one backtest CSV, say what was understood, and compute the figures of the report.
 * Pure functions, no I/O: the API route of /check calls them on the server, the tests call them
 * directly. Nothing here evaluates user text: the CSV is split into cells and every cell is read with
 * Number() or a fixed date pattern, nothing else.
 *
 * Formulas are the repository's, not new ones:
 * - PSR, DSR, SR0, MinTRL, annualization: sharpe.ts (Bailey and Lopez de Prado 2012, 2014).
 * - Moments: biased (divide by T), skewness and NON-EXCESS kurtosis, as the desktop app's
 *   DSR; V = 1/T when the user gives no dispersion. The tests pin the app's Python output on fixed
 *   series.
 * - PBO: cscv.ts (CSCV, Bailey, Borwein, Lopez de Prado and Zhu 2017), only when the CSV
 *   holds several configurations. It is printed as an exploratory statistic (app rule since 07/08:
 *   upward-biased below about 100 configurations).
 */
import { CSCVError, MAX_COMBINATIONS, combinations, runCSCV } from "./cscv.ts";
import { MIN_OBSERVATIONS } from "./check_rule.ts";
import { ALGORITHM_VERSION, SharpeInputError, annualize, dsr, minTrl, psr, trialCount } from "./sharpe.ts";

export const MAX_BYTES = 2_000_000;
export const MAX_ROWS = 100_000;
export const MAX_COLUMNS = 200;
/** The one sentence for a refused size, shown by /api/check and by the landing panel (16/10: written by hand in 4 places). */
export const TOO_LARGE_MESSAGE = `The file is too large. The limit is ${MAX_BYTES / 1_000_000} MB.`;
export const MAX_TRIALS = 1_000_000_000;
/** Version of the reading rules and of the verdict rule. A change to either takes a new number. */
export const CHECK_VERSION = 2;

export type Format = "returns" | "equity" | "trades" | "matrix";
export const FORMATS: readonly Format[] = ["returns", "equity", "trades", "matrix"];
export type Verdict = "NOT CONCLUSIVE";

export class CheckInputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CheckInputError";
    this.code = code;
  }
}

/**
 * A piece of the user's file quoted inside an error message. 07/10: a refused file gets a plain sentence;
 * echoing a raw cell let braces, double quotes or control characters reach the message, so a cell such as
 * {"error":1} made the sentence look like JSON. The quoted text keeps letters, digits and ordinary
 * punctuation, at most 40 characters, between single quotes.
 */
const QUOTE_DROPPED = "{}[]\"<>\\`";
export function quoteForMessage(text: string): string {
  const clean = Array.from(String(text), ch => {
    const c = ch.codePointAt(0) ?? 0;
    return c < 0x20 || (c >= 0x7f && c <= 0x9f) || QUOTE_DROPPED.includes(ch) ? " " : ch;
  }).join("").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return clean ? `'${clean}'` : "an empty cell";
}

/* ---------------------------------------------------------------- CSV cells */

/** Splits CSV text into rows of trimmed cells. Comma, semicolon or tab, detected on the first row. */
export function splitCsv(text: string): string[][] {
  if (typeof text !== "string") throw new CheckInputError("csv", "The CSV must be text.");
  if (text.length > MAX_BYTES) throw new CheckInputError("too_large", `The CSV is limited to ${MAX_BYTES / 1_000_000} MB.`);
  const input = text.replace(/^\uFEFF/, "");
  if (input.includes("\u0000")) throw new CheckInputError("csv", "The file looks binary; paste or drop a CSV text file.");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const outsideQuotes = firstLine.replace(/"[^"]*"/g, "");
  const sep = outsideQuotes.includes("\t") ? "\t" : outsideQuotes.includes(";") && !outsideQuotes.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const push = () => {
    row.push(cell.trim()); cell = "";
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell.trim()) throw new CheckInputError("csv", `Row ${rows.length + 1}: a quote must begin a cell.`);
      else quoted = !quoted;
    } else if (!quoted && (ch === sep || ch === "\n" || ch === "\r")) {
      push();
      if (ch !== sep) {
        if (row.some(v => v !== "")) {
          rows.push(row);
          if (rows.length > MAX_ROWS + 1) throw new CheckInputError("too_many_rows", `The CSV is limited to ${MAX_ROWS.toLocaleString("en-US")} rows.`);
        }
        row = [];
        if (ch === "\r" && input[i + 1] === "\n") i++;
      }
    } else cell += ch;
  }
  if (quoted) throw new CheckInputError("csv", "A quoted cell is not closed.");
  push();
  if (row.some(v => v !== "")) rows.push(row);
  if (!rows.length) throw new CheckInputError("empty", "The CSV is empty.");
  if (rows.length > MAX_ROWS + 1) throw new CheckInputError("too_many_rows", `The CSV is limited to ${MAX_ROWS.toLocaleString("en-US")} rows.`);
  return rows;
}

/** A number cell: plain decimal or exponent notation, optional trailing %, never Infinity or NaN. */
export function readNumber(cell: string): { value: number; percent: boolean } | null {
  const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(\s*%)?$/.exec(cell.trim());
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return m[2] ? { value: v / 100, percent: true } : { value: v, percent: false };
}

/**
 * A date cell: YYYY-MM-DD or YYYY/MM/DD, optionally followed by a time (space or T, HH:MM or HH:MM:SS,
 * optional fraction, optional Z). Day-first and month-first forms are refused: 03/04/2024 has two readings.
 * Returns milliseconds since the epoch, UTC.
 */
export function readDate(cell: string): number | null {
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?)?$/.exec(cell.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number);
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  return t;
}

const AMBIGUOUS_DATE = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/;

/* ---------------------------------------------------------------- detection */

export interface Parsed {
  format: Format;
  /** How the format was chosen: by the user, by a header name, or by the shape of the values. */
  formatSource: "user" | "header" | "values";
  /** One sentence per decision, in the order they were taken. Shown to the user as "what we understood". */
  understood: string[];
  /** The selected series: returns per period (returns, equity, matrix) or PnL per trade (trades). */
  series: number[];
  /** Equity levels, when the format is equity. */
  equity: number[] | null;
  /** Matrix of returns, T rows by K columns, when the format is matrix. */
  matrix: number[][] | null;
  names: string[];
  dates: number[] | null;
  rowsRead: number;
}

const HINTS: { format: Format; re: RegExp }[] = [
  { format: "trades", re: /^(?:pnl|p&l|p\/l|profit|profit_?loss|net_?profit|net_?pnl|trade_?pnl|gain)$/i },
  { format: "equity", re: /^(?:equity|balance|nav|account_?value|portfolio_?value|value|capital|cumulative_?equity)$/i },
  { format: "returns", re: /^(?:returns?|ret|daily_?returns?|pct_?change|r)$/i },
];

function headerHint(name: string): Format | null {
  const n = name.trim().replace(/\s+/g, "_").replace(/\(.*\)$/, "").replace(/_+$/, "");
  for (const h of HINTS) if (h.re.test(n)) return h.format;
  return null;
}

function isDateColumn(cells: string[]): boolean {
  return cells.length > 0 && cells.every(c => readDate(c) !== null);
}

/**
 * Reads the CSV and decides its format. `requested` forces one ("auto" lets the values decide).
 * Rules, in order:
 * 1. A first row that does not parse as numbers or dates is a header.
 * 2. A first column of dates is a date column; any other date-looking column is refused.
 * 3. Several numeric columns and no header hint: a matrix of configurations (returns), one per column.
 * 4. One numeric column (or a hinted one): its header name decides (pnl / profit: trades; equity /
 *    balance / nav: equity; return: returns). Without a hint: every value positive and their mean
 *    above 0.5 reads as equity; every absolute value below 1 reads as returns; anything else needs dates
 *    and reads as trades (PnL in money).
 */
export function parseBacktestCsv(text: string, requested: Format | "auto" = "auto"): Parsed {
  const rows = splitCsv(text);
  const understood: string[] = [];
  const isDataCell = (c: string) => readNumber(c) !== null || readDate(c) !== null;
  const header = rows[0].some(c => c !== "" && !isDataCell(c)) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;
  if (!body.length) throw new CheckInputError("empty", "The CSV has a header but no data rows.");
  if (body.length > MAX_ROWS) throw new CheckInputError("too_many_rows", `The CSV is limited to ${MAX_ROWS.toLocaleString("en-US")} rows.`);
  const width = header ? header.length : body[0].length;
  const tooWide = () => new CheckInputError("too_many_columns", `The CSV is limited to ${MAX_COLUMNS} columns.`);
  // cheap bound before the row scan: no file carries more than MAX_COLUMNS data columns plus one date column
  if (width > MAX_COLUMNS + 1) throw tooWide();
  body.forEach((r, i) => {
    if (r.length !== width) throw new CheckInputError("ragged", `Row ${i + (header ? 2 : 1)} has ${r.length} cells; the ${header ? "header" : "first row"} has ${width}.`);
  });
  const names = header ? header.map((h, i) => h || `column ${i + 1}`) : Array.from({ length: width }, (_, i) => `column ${i + 1}`);
  understood.push(header ? `Header row found: ${names.map(n => `"${n}"`).join(", ")}.` : "No header row; the first row is data.");

  const column = (j: number) => body.map(r => r[j]);
  let dateCol = -1;
  if (isDateColumn(column(0))) dateCol = 0;
  else if (body.some(r => AMBIGUOUS_DATE.test(r[0]))) {
    throw new CheckInputError("date_format", "The first column looks like dates in day-first or month-first form. Write dates as YYYY-MM-DD.");
  }
  // 16/10: the limit counts DATA columns. It allowed MAX_COLUMNS + 1 cells whether or not the first one was a
  // date, so 201 configurations without a date column passed while the page announces 200.
  if (width - (dateCol === 0 ? 1 : 0) > MAX_COLUMNS) throw tooWide();
  // Columns that are neither dates nor numbers everywhere (symbol, side...) are allowed only with a header naming the PnL.
  const numericCols: number[] = [];
  for (let j = 0; j < width; j++) {
    if (j === dateCol) continue;
    const cells = column(j);
    if (cells.every(c => readNumber(c) !== null)) numericCols.push(j);
  }
  if (!numericCols.length) {
    // name the first cell that is not a number, so a single typo is found without guessing
    const j = dateCol === 0 && width > 1 ? 1 : 0;
    const bad = body.findIndex(r => readNumber(r[j]) === null);
    throw new CheckInputError("not_number", `No column holds only numbers. Row ${bad + (header ? 2 : 1)}, column ${quoteForMessage(names[j])}: ${quoteForMessage(body[bad][j])} is not a number.`);
  }
  const hinted = header ? numericCols.filter(j => headerHint(names[j]) !== null) : [];
  const nonNumericOther = Array.from({ length: width }, (_, j) => j).filter(j => j !== dateCol && !numericCols.includes(j));
  if (nonNumericOther.length && !hinted.length) {
    const j = nonNumericOther[0];
    const bad = body.findIndex(r => readNumber(r[j]) === null);
    throw new CheckInputError("not_number", `Row ${bad + (header ? 2 : 1)}, column ${quoteForMessage(names[j])}: ${quoteForMessage(body[bad][j])} is not a number.`);
  }
  if (dateCol === 0) understood.push(`Column "${names[0]}" read as dates.`);

  const values = (j: number) => {
    let percent = false;
    const v = column(j).map(c => { const n = readNumber(c)!; percent ||= n.percent; return n.value; });
    return { v, percent };
  };
  const dates = dateCol === 0 ? column(0).map(c => readDate(c)!) : null;

  let format: Format;
  let formatSource: Parsed["formatSource"];
  let col = numericCols[0];
  if (requested !== "auto") {
    format = requested; formatSource = "user";
    if (format !== "matrix") col = hinted[0] ?? numericCols[0];
    understood.push(`Format set by you: ${format}.`);
  } else if (hinted.length) {
    col = hinted[0]; format = headerHint(names[col])!; formatSource = "header";
    understood.push(`Format read from the header "${names[col]}": ${format}.`);
  } else if (numericCols.length >= 2) {
    format = "matrix"; formatSource = "values";
    understood.push(`${numericCols.length} numeric columns and no header naming one of them: read as ${numericCols.length} configurations, returns per period, one per column.`);
  } else {
    const { v } = values(col);
    formatSource = "values";
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    if (v.every(x => x > 0) && mean > 0.5) {
      format = "equity";
      understood.push("Every value is positive and their mean is above 0.5: read as an equity curve.");
    } else if (v.every(x => Math.abs(x) < 1)) {
      format = "returns";
      understood.push("Every value lies between -1 and 1: read as returns per period, in decimals (0.01 = 1%).");
    } else if (dates) {
      format = "trades";
      understood.push("Values beyond -1 and 1 with negative values, next to dates: read as profit and loss per trade, in money.");
    } else {
      throw new CheckInputError("ambiguous", "The values are neither returns between -1 and 1 nor a positive equity curve. For trades, add a date column, or choose the format.");
    }
  }

  if (format === "trades" && !dates) throw new CheckInputError("trades_need_dates", "Trades need a first column of dates (YYYY-MM-DD) to measure how many trades happen per year.");
  if (dates && format !== "trades") {
    for (let i = 1; i < dates.length; i++) {
      if (!(dates[i] > dates[i - 1])) throw new CheckInputError("dates_order", `Row ${i + (header ? 2 : 1)}: dates must be strictly increasing for ${format}; for several trades on one day use the trades format.`);
    }
  }
  if (dates && format === "trades") {
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] < dates[i - 1]) throw new CheckInputError("dates_order", `Row ${i + (header ? 2 : 1)}: trade dates must not go backwards.`);
    }
  }

  const out: Parsed = { format, formatSource, understood, series: [], equity: null, matrix: null, names, dates, rowsRead: body.length };
  if (format === "matrix") {
    const cols = numericCols.map(values);
    if (cols.length < 2) throw new CheckInputError("matrix_columns", "A matrix of configurations needs at least two numeric columns.");
    if (cols.some(c => c.v.some(x => x <= -1))) throw new CheckInputError("returns_range", "A return of -100% or below is not a return per period; check the matrix holds returns in decimals.");
    if (cols.some(c => c.percent)) understood.push("Values ending in % were divided by 100.");
    out.matrix = body.map((_, t) => cols.map(c => c.v[t]));
    out.names = numericCols.map(j => names[j]);
    return out;
  }
  const { v, percent } = values(col);
  if (numericCols.length > 1 || nonNumericOther.length) understood.push(`Column used: "${names[col]}". Other columns are ignored.`);
  if (percent) understood.push("Values ending in % were divided by 100.");
  if (format === "returns") {
    if (v.some(x => x <= -1)) throw new CheckInputError("returns_range", "A return of -100% or below cannot be a return per period. If these are percentages, add a % sign or divide by 100.");
    if (v.some(x => Math.abs(x) >= 1)) understood.push("Some returns are 100% or more in one period; check they are decimals, not percentages.");
    out.series = v;
  } else if (format === "equity") {
    if (v.some(x => !(x > 0))) throw new CheckInputError("equity_positive", "An equity curve must stay above zero. For profit and loss per trade, use the trades format.");
    if (v.length < 2) throw new CheckInputError("too_short", "An equity curve needs at least two points.");
    out.equity = v;
    out.series = v.slice(1).map((x, i) => x / v[i] - 1);
    understood.push(`Returns per period computed from ${v.length} equity points: ${v.length - 1} returns.`);
  } else {
    out.series = v;
    understood.push(`${v.length} trades read; the Sharpe ratio is per trade, then annualized by the number of trades per year measured from the dates.`);
  }
  return out;
}

/* ---------------------------------------------------------------- figures */

export interface Moments { mean: number; sd: number; sr: number; skew: number; kurtosis: number }

/** Biased moments, as the desktop app's DSR computes them. null for a constant series. */
export function moments(r: number[]): Moments | null {
  const n = r.length;
  if (n < 3) return null;
  const mean = r.reduce((a, b) => a + b, 0) / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of r) { const c = x - mean; const c2 = c * c; m2 += c2; m3 += c2 * c; m4 += c2 * c2; }
  m2 /= n; m3 /= n; m4 /= n;
  if (!(m2 > 0)) return null;
  const sd = Math.sqrt(m2);
  // 16/10: 0.001 repeated leaves m2 ~ 1e-38 of round-off, not 0, and the series reached the PSR as a kurtosis
  // error. Equal values are constant, and so is a spread under the resolution of a double at the mean (64 eps):
  // it is round-off of the arithmetic, not data. A wider spread, however small, is measured (review: a
  // 1e-10 bound refused 0.001, 0.00100000000001, 0.00099999999999).
  if (r.every(x => x === r[0]) || sd <= 64 * Number.EPSILON * Math.abs(mean)) return null;
  return { mean, sd, sr: mean / sd, skew: m3 / sd ** 3, kurtosis: m4 / (m2 * m2) };
}

/** Largest fall from a running peak of a level curve, as a fraction of that peak (negative or 0). */
export function maxDrawdownLevels(levels: number[]): number {
  let peak = -Infinity, dd = 0;
  for (const x of levels) { if (x > peak) peak = x; if (peak > 0) dd = Math.min(dd, x / peak - 1); }
  return dd;
}

/** Drawdown of compounded returns, starting capital 1 included (as the app's max_dd includes it). */
export function maxDrawdownReturns(r: number[]): number {
  const levels = [1];
  for (const x of r) levels.push(levels[levels.length - 1] * (1 + x));
  return maxDrawdownLevels(levels);
}

/** Largest fall of cumulative PnL from its running peak, starting at 0; in the PnL's own unit (negative or 0). */
export function maxDrawdownPnl(pnl: number[]): number {
  let cum = 0, peak = 0, dd = 0;
  for (const x of pnl) { cum += x; if (cum > peak) peak = cum; dd = Math.min(dd, cum - peak); }
  return dd;
}

/** Trades per year from the first and last trade dates. null when they span less than one day. */
export function tradesPerYear(dates: number[]): number | null {
  const span = (dates[dates.length - 1] - dates[0]) / 86_400_000;
  if (!(span >= 1)) return null;
  return (dates.length - 1) / (span / 365.25);
}

/**
 * Work budget of one CSCV on the server, in split-configurations (C(S,S/2) x K). Review of 07/10:
 * the page accepts 200 configurations, and S = 16 then means 12,870 splits x 200 columns, measured at
 * 623 ms of synchronous CPU per request on the server, blocking every other visitor of the site for that
 * time. Under this budget a wide matrix gets fewer blocks (S = 12 for 200 columns, about 50 ms), and the
 * report says so; a matrix of up to 15 configurations keeps S = 16.
 */
export const MAX_CSCV_WORK = 200_000;

/** CSCV blocks: the largest even S from 16 down to 4 with T >= 4S and C(S,S/2) x K within the budget. null when none fits. */
export function chooseS(t: number, k = 1): number | null {
  for (let s = 16; s >= 4; s -= 2) {
    const splits = combinations(s, s / 2);
    if (t >= 4 * s && splits <= MAX_COMBINATIONS && splits * k <= MAX_CSCV_WORK) return s;
  }
  return null;
}

export interface CheckOptions {
  format: Format | "auto";
  nTrials: number;
  /** Periods per year for returns, equity and matrix. Ignored for trades (measured from the dates). */
  periodsPerYear: number;
  /** Optional: standard deviation of the ANNUAL Sharpe ratios of the trials. null: V = 1/T is assumed. */
  sharpeStdAnnual: number | null;
}

export interface Report {
  version: number;
  algorithm: number;
  format: Format;
  formatSource: Parsed["formatSource"];
  understood: string[];
  observations: number;
  periodsPerYear: number;
  periodsPerYearSource: "declared" | "measured_from_dates";
  firstDate: string | null;
  lastDate: string | null;
  sharpePerPeriod: number;
  sharpeAnnual: number;
  skew: number;
  kurtosis: number;
  maxDrawdown: number;
  maxDrawdownUnit: "fraction" | "pnl";
  nTrialsDeclared: number;
  nTrialsUsed: number;
  variance: number;
  varianceSource: "declared" | "null_1_over_T" | "matrix_columns";
  psr: number;
  sr0: number;
  sr0Annual: number;
  dsr: number;
  /** MinTRL to reach 95% confidence that the true Sharpe ratio exceeds SR0; null when SR <= SR0. */
  minTrl: number | null;
  /** Matrix only: the configuration analysed (best full-sample Sharpe ratio) and K. */
  selected: string | null;
  /** Matrix only: the column index of `selected` in `Parsed.matrix` (names can repeat; the index cannot). */
  selectedIndex: number | null;
  configurations: number | null;
  pbo: { value: number | null; s: number; used: number; total: number; tied: number; distinct: number; note: string } | null;
  pboNote: string;
  verdict: Verdict;
  verdictReason: string;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Each discard reason that runCSCV (cscv.ts) can return, in plain words. A tie for the best in-sample score is not
 *  one: since 16/10 a tied split counts the average over its tied winners (tiesNote). */
export const DISCARD_REASONS: Record<string, string> = {
  "undefined IS or OOS score": "a configuration has constant returns over a split half, so its Sharpe ratio is undefined",
  "fewer than five OOS observations after embargo": "fewer than five out-of-sample observations remain after the embargo",
  "global undefined Sortino ratio": "a configuration never loses, so its Sortino ratio is undefined",
  "identical configurations": "every column is the same configuration (identical, or a power-of-two multiple of another, such as its double), so nothing is selected",
};

/** Why the PBO is undefined, in words: each discard reason of the CSCV with its count (16/10: the note blamed
 *  constant returns for every discard; the reader was sent to look for the wrong thing). */
export function discardedNote(discarded: Record<string, number>, total: number): string {
  const parts = Object.entries(discarded).filter(([, n]) => n > 0)
    .map(([reason, n]) => `${n.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} splits discarded: ${DISCARD_REASONS[reason] ?? reason}`);
  return `PBO undefined: ${parts.length ? parts.join("; ") : "some splits were discarded"}. The PBO is only reported when every split counts.`;
}

/** How ties and merged columns were counted (16/10). The paper picks one in-sample winner; when k configurations tie,
 *  the split counts the average of their k out-of-sample readings, the expected value of a random pick among them. */
export function tiesNote(r: { tied: number; total: number; merged: number; distinct: number; K: number }, score = "Sharpe ratio"): string {
  const parts: string[] = [];
  if (r.merged > 0) parts.push(`${r.merged.toLocaleString("en-US")} of the ${r.K.toLocaleString("en-US")} columns repeat another configuration (identical, or a power-of-two multiple, such as a double) and were merged: ${r.distinct.toLocaleString("en-US")} distinct configurations are ranked.`);
  if (r.tied > 0) parts.push(`In ${r.tied.toLocaleString("en-US")} of ${r.total.toLocaleString("en-US")} splits, several configurations tied for the best in-sample ${score}; each such split counts the average over its tied winners (weight 1/k for k tied), the expected value of picking one of them at random.`);
  return parts.join(" ");
}

/** Parses and computes. Throws CheckInputError (or SharpeInputError) with a sentence for the user. */
export function checkBacktest(text: string, opts: CheckOptions): Report {
  const nDeclared = (() => {
    try { return trialCount(opts.nTrials); }
    catch { throw new CheckInputError("n", "N, the number of strategies or settings tried, must be a whole number of at least 1."); }
  })();
  if (nDeclared > MAX_TRIALS) throw new CheckInputError("n", "N is limited to one billion trials.");
  if (opts.sharpeStdAnnual !== null && !(Number.isFinite(opts.sharpeStdAnnual) && opts.sharpeStdAnnual >= 0 && opts.sharpeStdAnnual <= 100)) {
    throw new CheckInputError("v", "The standard deviation of the trials' annual Sharpe ratios must be a number between 0 and 100.");
  }
  const parsed = parseBacktestCsv(text, opts.format);
  const understood = [...parsed.understood];

  let ppy: number;
  let ppySource: Report["periodsPerYearSource"] = "declared";
  if (parsed.format === "trades") {
    const m = tradesPerYear(parsed.dates!);
    if (m === null) throw new CheckInputError("span", "The trades span less than one day; the number of trades per year cannot be measured.");
    ppy = m; ppySource = "measured_from_dates";
    understood.push(`Trades per year measured from the dates: ${m.toFixed(1)}. The frequency you chose is not used for trades.`);
  } else {
    if (!(Number.isFinite(opts.periodsPerYear) && opts.periodsPerYear > 0 && opts.periodsPerYear <= 600_000)) {
      throw new CheckInputError("ppy", "Periods per year must be a positive number.");
    }
    ppy = opts.periodsPerYear;
  }

  let series = parsed.series;
  let selected: string | null = null;
  let selectedIndex: number | null = null;
  let configurations: number | null = null;
  let nUsed = nDeclared;
  let variance: number;
  let varianceSource: Report["varianceSource"];
  let pbo: Report["pbo"] = null;
  let pboNote = "PBO not computed: it needs the returns of every configuration tried, one per column. A single series cannot show how the best of many was picked.";

  if (parsed.format === "matrix") {
    const matrix = parsed.matrix!;
    const k = matrix[0].length;
    const srs = Array.from({ length: k }, (_, j) => moments(matrix.map(r => r[j]))?.sr ?? null);
    if (srs.some(s => s === null)) throw new CheckInputError("constant", "A configuration has constant returns or fewer than 3 rows; its Sharpe ratio is not defined.");
    const s = srs as number[];
    let best = 0;
    for (let j = 1; j < k; j++) if (s[j] > s[best]) best = j;
    selected = parsed.names[best]; selectedIndex = best; configurations = k;
    series = matrix.map(r => r[best]);
    nUsed = Math.max(nDeclared, k);
    understood.push(`Configuration analysed: "${selected}", the highest Sharpe ratio of the ${k}. N used: ${nUsed} (the larger of your N and the ${k} columns).`);
    const meanSr = s.reduce((a, b) => a + b, 0) / k;
    const sampleV = s.reduce((a, b) => a + (b - meanSr) ** 2, 0) / (k - 1);
    if (opts.sharpeStdAnnual !== null) {
      variance = (opts.sharpeStdAnnual / Math.sqrt(ppy)) ** 2; varianceSource = "declared";
    } else {
      variance = sampleV; varianceSource = "matrix_columns";
    }
    const S = chooseS(matrix.length, k);
    const reduced = S !== null && chooseS(matrix.length) !== S;
    if (S === null) {
      pboNote = matrix.length < 16
        ? `PBO not computed: CSCV needs at least 16 rows (4 blocks of 4); the matrix has ${matrix.length}.`
        : `PBO not computed: ${k} configurations exceed the computing budget of this free check.`;
    } else {
      try {
        const r = runCSCV({ matrix, S, score: "sharpe", embargo: 0, ppy });
        const note = k < 100 ? "Exploratory with fewer than about 100 configurations; there is no pass or fail threshold." : "There is no pass or fail threshold.";
        const ties = tiesNote(r);
        pbo = { value: r.pbo, s: S, used: r.used, total: r.total, tied: r.tied, distinct: r.distinct, note: ties ? `${note} ${ties}` : note };
        pboNote = r.pbo === null ? discardedNote(r.discarded, r.total) : `PBO computed by CSCV with S = ${S} blocks, Sharpe ratio as the selection score.${reduced ? ` With ${k} configurations the number of blocks is reduced to keep the free check fast.` : ""}${ties ? ` ${ties}` : ""}`;
      } catch (e) {
        if (!(e instanceof CSCVError)) throw e;
        pboNote = `PBO not computed: ${e.message}.`;
      }
    }
  } else {
    variance = NaN; varianceSource = "null_1_over_T";
  }

  const t = series.length;
  const m = moments(series);
  if (!m) throw new CheckInputError("constant", t < 3 ? "At least 3 observations are needed." : "The series is constant; its Sharpe ratio is not defined.");
  if (parsed.format !== "matrix") {
    if (opts.sharpeStdAnnual !== null) { variance = (opts.sharpeStdAnnual / Math.sqrt(ppy)) ** 2; varianceSource = "declared"; }
    else { variance = 1 / t; varianceSource = "null_1_over_T"; }
  }

  let p: number, d: { sr0: number; dsr: number };
  try {
    p = psr({ sr: m.sr, srStar: 0, t, skew: m.skew, kurtosis: m.kurtosis });
    d = dsr({ sr: m.sr, t, skew: m.skew, kurtosis: m.kurtosis, nTrials: nUsed, variance: variance! });
  } catch (e) {
    if (e instanceof SharpeInputError) throw new CheckInputError("moments", `The probabilistic Sharpe ratio is not defined for this series: ${e.message}.`);
    throw e;
  }
  let mtrl: number | null = null;
  if (m.sr > d.sr0) {
    try { mtrl = minTrl({ sr: m.sr, srStar: d.sr0, skew: m.skew, kurtosis: m.kurtosis, confidence: 0.95 }); } catch { mtrl = null; }
  }

  const verdict: Verdict = "NOT CONCLUSIVE";
  let verdictReason: string;
  if (t < MIN_OBSERVATIONS) {
    verdictReason = `${t} observations: fewer than ${MIN_OBSERVATIONS} makes even the statistical reading fragile. This CSV cannot verify the desktop app's prerequisites for a strategy verdict.`;
  } else {
    verdictReason = `DSR ${d.dsr.toFixed(4)} is a conditional statistical reading. This CSV cannot verify an out-of-sample split, charged costs, a directional benchmark, or the full selection test required for a strategy verdict.`;
  }

  let maxDrawdown: number, unit: Report["maxDrawdownUnit"] = "fraction";
  if (parsed.format === "equity") maxDrawdown = maxDrawdownLevels(parsed.equity!);
  else if (parsed.format === "trades") { maxDrawdown = maxDrawdownPnl(series); unit = "pnl"; }
  else maxDrawdown = maxDrawdownReturns(series);

  const dates = parsed.dates;
  return {
    version: CHECK_VERSION, algorithm: ALGORITHM_VERSION, format: parsed.format, formatSource: parsed.formatSource, understood,
    observations: t, periodsPerYear: ppy, periodsPerYearSource: ppySource,
    firstDate: dates ? isoDay(dates[0]) : null, lastDate: dates ? isoDay(dates[dates.length - 1]) : null,
    sharpePerPeriod: m.sr, sharpeAnnual: annualize(m.sr, ppy), skew: m.skew, kurtosis: m.kurtosis,
    maxDrawdown, maxDrawdownUnit: unit, nTrialsDeclared: nDeclared, nTrialsUsed: nUsed,
    variance: variance!, varianceSource: varianceSource!, psr: p, sr0: d.sr0, sr0Annual: d.sr0 * Math.sqrt(ppy), dsr: d.dsr,
    minTrl: mtrl, selected, selectedIndex, configurations, pbo, pboNote, verdict, verdictReason,
  };
}

/* ---------------------------------------------------------------- request body */

export interface CheckRequest extends CheckOptions { csv: string }

const REQUEST_KEYS = new Set(["csv", "format", "nTrials", "periodsPerYear", "sharpeStdAnnual"]);

/** Strict validation of the JSON body of /api/check and /api/check/publish. Unknown keys are refused. */
export function parseCheckRequest(raw: unknown): CheckRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CheckInputError("body", "The request must be a JSON object.");
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!REQUEST_KEYS.has(k)) throw new CheckInputError("body", `Unknown field: ${quoteForMessage(k)}.`);
  if (typeof o.csv !== "string" || !o.csv.trim()) throw new CheckInputError("csv", "Paste or drop a CSV first.");
  const format = o.format ?? "auto";
  if (format !== "auto" && !FORMATS.includes(format as Format)) throw new CheckInputError("format", "Unknown format.");
  if (typeof o.nTrials !== "number") throw new CheckInputError("n", "N, the number of strategies or settings tried, must be a whole number of at least 1.");
  if (typeof o.periodsPerYear !== "number") throw new CheckInputError("ppy", "Periods per year must be a positive number.");
  const v = o.sharpeStdAnnual ?? null;
  if (v !== null && typeof v !== "number") throw new CheckInputError("v", "The standard deviation of the trials' annual Sharpe ratios must be a number.");
  return { csv: o.csv, format: format as Format | "auto", nTrials: o.nTrials, periodsPerYear: o.periodsPerYear, sharpeStdAnnual: v as number | null };
}


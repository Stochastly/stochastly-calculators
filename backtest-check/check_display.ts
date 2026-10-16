// 07/10: how a /check report is printed. Shared by the page (client) and the published report page
// (server), so a published report reads exactly as it did on screen. No import of the computation:
// the client bundle stays small.
import type { Format, Report } from "./check_backtest.ts";
import { formatProbability } from "./sharpe.ts";

export const FORMAT_LABEL: Record<Format, string> = {
  returns: "Returns per period",
  equity: "Equity curve",
  trades: "Trades with date and PnL",
  matrix: "Matrix of configurations",
};

export const VARIANCE_LABEL: Record<Report["varianceSource"], string> = {
  declared: "from the standard deviation of the trials' annual Sharpe ratios you entered",
  null_1_over_T: "assumed: V = 1/T, the variance of a Sharpe ratio estimated on T returns when the true Sharpe ratio is 0 (independent returns). Enter the dispersion of your trials to replace it",
  matrix_columns: "measured: the sample variance of the per-period Sharpe ratios of the configurations in your matrix",
};

const fixed = (x: number | null, d: number) => x === null || !Number.isFinite(x) ? "not defined" : x.toFixed(d);

export function formatDrawdown(r: Pick<Report, "maxDrawdown" | "maxDrawdownUnit">): string {
  if (r.maxDrawdownUnit === "pnl") return `${r.maxDrawdown.toLocaleString("en-US", { maximumFractionDigits: 2 })} (PnL units)`;
  return `${(r.maxDrawdown * 100).toFixed(1)}%`;
}

const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/\.?$/, ".");

/** One printed row: a label, a short value (a figure or two words), and the explanation under it if any.
 * 07/10: the explanation used to sit in the value cell and squeezed the label column to one word per line. */
export type ReportRow = [label: string, value: string, note?: string];

/** The rows of the report, in the order the page prints them. */
export function reportRows(r: Omit<Report, "understood" | "selected" | "selectedIndex">): ReportRow[] {
  const rows: ReportRow[] = [
    ["Format", FORMAT_LABEL[r.format]],
    ["Observations, T", String(r.observations)],
    [r.periodsPerYearSource === "measured_from_dates" ? "Trades per year (measured from the dates)" : "Periods per year (declared)", fixed(r.periodsPerYear, 1)],
  ];
  if (r.firstDate && r.lastDate) rows.push(["Date range", `${r.firstDate} to ${r.lastDate}`]);
  rows.push(
    ["Sharpe ratio, annualized", fixed(r.sharpeAnnual, 3)],
    ["Sharpe ratio, per period", fixed(r.sharpePerPeriod, 4)],
    ["Skewness", fixed(r.skew, 3)],
    ["Kurtosis (normal = 3)", fixed(r.kurtosis, 3)],
    ["Maximum drawdown", formatDrawdown(r)],
    ["PSR, probability that the true Sharpe ratio exceeds 0", formatProbability(r.psr)],
    ["N, trials used for the deflation", r.nTrialsUsed === r.nTrialsDeclared ? String(r.nTrialsUsed) : `${r.nTrialsUsed} (declared ${r.nTrialsDeclared})`],
    ["V, variance of the trials' per-period Sharpe ratios", String(Number(r.variance.toPrecision(4))), sentence(VARIANCE_LABEL[r.varianceSource])],
    ["SR0, best annualized Sharpe ratio expected from N trials without skill", fixed(r.sr0Annual, 3)],
    ["DSR, deflated Sharpe ratio", formatProbability(r.dsr)],
    ["MinTRL, observations needed for 95% confidence above SR0", ...(r.minTrl === null ? ["not defined", "The Sharpe ratio does not exceed SR0."] as const : [String(Math.ceil(r.minTrl))] as const)],
  );
  if (r.configurations !== null) rows.push(["Configurations in the matrix, K", String(r.configurations)]);
  const pboLabel = "PBO, probability of backtest overfitting";
  if (r.pbo && r.pbo.value !== null) rows.push([pboLabel, r.pbo.value.toFixed(3), sentence(`S = ${r.pbo.s}, ${r.pbo.used} of ${r.pbo.total} splits. ${r.pbo.note}`)]);
  else rows.push([pboLabel, r.pbo ? "not defined" : "not computed", r.pboNote]);
  return rows;
}

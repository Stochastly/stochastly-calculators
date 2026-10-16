// 07/10: the verdict rule of /check, alone in its file so the page can print it without loading the
// computation. check_backtest.ts applies it; the tests check both agree.
export const MIN_OBSERVATIONS = 30;

export const VERDICT_RULE =
  `This CSV supplies a conditional statistical reading, not a strategy GO or NO-GO. A strategy verdict needs verified in-sample and out-of-sample observations, charged costs, an out-of-sample directional benchmark, and selection-luck evidence. With fewer than ${MIN_OBSERVATIONS} observations even the statistical reading is especially fragile. DSR depends on the declared selection population and its assumptions; PBO is exploratory when a matrix is supplied.`;

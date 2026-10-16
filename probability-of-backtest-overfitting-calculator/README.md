# Probability of backtest overfitting (PBO) calculator

Combinatorially symmetric cross-validation (CSCV) on a T x K matrix of returns: every split of S blocks into two halves, the in-sample winner, its out-of-sample rank, and the share of splits where that rank falls below the median.

Live calculator: [stochastly.com/tools/probability-of-backtest-overfitting-calculator](https://stochastly.com/tools/probability-of-backtest-overfitting-calculator)

## Formula

```
for each of C(S, S/2) splits: n* = argmax in-sample score; w = rank of n* out of sample / (K + 1)
logit = ln(w / (1 - w)); PBO = share of splits with logit < 0
ties: columns identical once each is divided by the power of two just above its largest |return| (so a column and its double, but not its triple) are one configuration (merged; K counts distinct ones); when k configurations tie for the best in-sample score, the split counts (1/k) * sum of 1[logit < 0] over the tied winners, the expected value of picking one at random (the paper defines a single argmax)
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { runCSCV } from "./cscv.ts";
import { parseMatrixCSV } from "./cscv-csv.ts";

// two configurations, the first better in every block: its out-of-sample rank is always first, PBO 0
const rows = Array.from({ length: 24 }, (_, t) => (t % 2 === 0 ? "0.03,0.01" : "-0.01,-0.02"));
const { matrix } = parseMatrixCSV(["fast,slow", ...rows].join("\n"));
const r = runCSCV({ matrix, S: 4, score: "sharpe", embargo: 0, ppy: 252 });
console.log(r.pbo, r.used, r.total); // 0 6 6
```

## Limits

One column per configuration; a first column of ISO dates (YYYY-MM-DD) is ignored. At least 4 observations per block (T >= 4S) and two configurations. The estimate is biased upward with few configurations and says nothing about a strategy outside the tried set.

## Reference

- Bailey, D. H., Borwein, J., Lopez de Prado, M. and Zhu, Q. J. (2017). The Probability of Backtest Overfitting. Journal of Computational Finance 20(4). https://doi.org/10.21314/JCF.2016.322

## Files

- `cscv.ts`: shared with 1 other folder, same bytes
- `cscv-csv.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

# Backtest check

Reads one backtest CSV (returns, equity curve, trades or a matrix of configurations), says how it read it, and computes the figures of the /check report: Sharpe ratio, skewness, kurtosis, PSR, DSR, MinTRL, maximum drawdown and, for a matrix, the PBO.

Live calculator: [stochastly.com/check](https://stochastly.com/check)

## Formula

```
PSR(SR*) = Phi((SR - SR*) sqrt(T - 1) / sqrt(1 - g3 SR + (g4 - 1)/4 SR^2))
SR0 = sqrt(V) ((1 - gamma) Phi^-1(1 - 1/N) + gamma Phi^-1(1 - 1/(N e)))
DSR = PSR(SR0)
V, without a declared dispersion: 1/T for one series; for a matrix, the sample variance of the columns' Sharpe ratios
N, for a matrix: the larger of the declared N and the number of columns
PBO = share of CSCV splits whose in-sample winner ranks below the out-of-sample median; k configurations tied in sample count 1/k each
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { checkBacktest } from "./check_backtest.ts";

const csv = ["date,return", "2024-01-02,0.004", "2024-01-03,-0.002", "2024-01-04,0.003", "2024-01-05,0.001", "2024-01-08,-0.001"].join("\n");
const report = checkBacktest(csv, { format: "auto", nTrials: 10, periodsPerYear: 252, sharpeStdAnnual: null });
console.log(report.format, report.observations, report.sharpePerPeriod.toFixed(4)); // returns 5 0.4385
```

## Limits

The strategy verdict stays NOT CONCLUSIVE: a CSV alone does not carry the cost model, the out-of-sample protocol or the number of trials the desktop app requires before it says GO or NO-GO. The PBO is exploratory below about 100 configurations.

## Reference

- Bailey, D. H. and Lopez de Prado, M. (2014). The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality. Journal of Portfolio Management 40(5), 94-107. https://doi.org/10.3905/jpm.2014.40.5.094
- Bailey, D. H. and Lopez de Prado, M. (2012). The Sharpe Ratio Efficient Frontier. Journal of Risk 15(2). https://doi.org/10.21314/JOR.2012.255
- Bailey, D. H., Borwein, J., Lopez de Prado, M. and Zhu, Q. J. (2017). The Probability of Backtest Overfitting. Journal of Computational Finance 20(4). https://doi.org/10.21314/JCF.2016.322

## Files

- `check_backtest.ts`
- `check_rule.ts`
- `check_display.ts`
- `sharpe.ts`: shared with 2 other folders, same bytes
- `cscv.ts`: shared with 1 other folder, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

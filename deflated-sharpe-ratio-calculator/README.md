# Deflated Sharpe ratio calculator

Probabilistic Sharpe ratio (PSR), minimum track record length (MinTRL) and deflated Sharpe ratio (DSR), plus the curve of the DSR as the number of trials N grows. Every Sharpe ratio is per period; kurtosis is non-excess (normal = 3).

Live calculator: [stochastly.com/tools/deflated-sharpe-ratio-calculator](https://stochastly.com/tools/deflated-sharpe-ratio-calculator)

## Formula

```
PSR(SR*) = Phi((SR - SR*) sqrt(T - 1) / sqrt(1 - g3 SR + (g4 - 1)/4 SR^2))
MinTRL = 1 + (1 - g3 SR + (g4 - 1)/4 SR^2) (Phi^-1(c) / (SR - SR*))^2
SR0 = sqrt(V) ((1 - gamma) Phi^-1(1 - 1/N) + gamma Phi^-1(1 - 1/(N e)))
DSR = PSR(SR0)
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./sharpe.ts";

// the worked example of Bailey and Lopez de Prado (2014): annual SR 2.5 on 1,250 days, 100 trials
const out = calculate({ sr: 0.1581139, t: 1250, skew: -3, kurtosis: 10, srStar: 0, confidence: 0.95, nTrials: 100, variance: 0.002, periodsPerYear: 250, nSource: "" });
console.log(out.sr0?.toFixed(4), out.dsr?.toFixed(4)); // 0.1132 0.9004
```

## Limits

V = 1/T when left empty is a large-sample value under the null of no skill; it ignores any spread of true skill between trials. The DSR needs an honest count of the trials actually run.

## Reference

- Bailey, D. H. and Lopez de Prado, M. (2014). The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality. Journal of Portfolio Management 40(5), 94-107. https://doi.org/10.3905/jpm.2014.40.5.094
- Bailey, D. H. and Lopez de Prado, M. (2012). The Sharpe Ratio Efficient Frontier. Journal of Risk 15(2). https://doi.org/10.21314/JOR.2012.255

## Files

- `sharpe.ts`: shared with 2 other folders, same bytes
- `sharpe_courbe.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

# stochastly-calculators

The TypeScript behind the free calculators on [stochastly.com](https://stochastly.com/tools). Each folder holds one calculation: the source file the website runs, a test, and a README with the formula and the paper it comes from.

The `.ts` files are copied byte for byte from the website's code by a generator. The website's test suite fails when that code changes without a new pinned copy, and each publication is compared with this repository file by file and path by path.

## Run the tests

Node.js runs TypeScript directly from version 22.18 in the 22 line and from 23.6 onwards, so there is nothing to install:

```
npm test
```

## Calculators

| Folder | Calculation | Page |
|---|---|---|
| [backtest-check](backtest-check) | Backtest check | [stochastly.com/check](https://stochastly.com/check) |
| [deflated-sharpe-ratio-calculator](deflated-sharpe-ratio-calculator) | Deflated Sharpe ratio calculator | [stochastly.com/tools/deflated-sharpe-ratio-calculator](https://stochastly.com/tools/deflated-sharpe-ratio-calculator) |
| [minimum-track-record-length-calculator](minimum-track-record-length-calculator) | Minimum track record length calculator | [stochastly.com/tools/minimum-track-record-length-calculator](https://stochastly.com/tools/minimum-track-record-length-calculator) |
| [probability-of-backtest-overfitting-calculator](probability-of-backtest-overfitting-calculator) | Probability of backtest overfitting (PBO) calculator | [stochastly.com/tools/probability-of-backtest-overfitting-calculator](https://stochastly.com/tools/probability-of-backtest-overfitting-calculator) |
| [trading-cost-break-even-calculator](trading-cost-break-even-calculator) | Trading cost break-even calculator | [stochastly.com/tools/trading-cost-break-even-calculator](https://stochastly.com/tools/trading-cost-break-even-calculator) |
| [pine-script-lookahead-checker](pine-script-lookahead-checker) | Pine Script look-ahead checker | [stochastly.com/tools/pine-script-lookahead-checker](https://stochastly.com/tools/pine-script-lookahead-checker) |
| [prop-firm-challenge-simulator](prop-firm-challenge-simulator) | Prop firm challenge simulator | [stochastly.com/tools/prop-firm-challenge-simulator](https://stochastly.com/tools/prop-firm-challenge-simulator) |
| [autocorrelation-adjusted-sharpe-calculator](autocorrelation-adjusted-sharpe-calculator) | Autocorrelation-adjusted Sharpe calculator | not open yet |
| [fractional-kelly-bet-calculator](fractional-kelly-bet-calculator) | Fractional Kelly bet calculator | not open yet |
| [two-strategy-portfolio-sharpe-calculator](two-strategy-portfolio-sharpe-calculator) | Two-strategy portfolio Sharpe calculator | not open yet |
| [volatility-target-leverage-calculator](volatility-target-leverage-calculator) | Volatility target leverage calculator | not open yet |
| [trade-edge-detection-sample-size](trade-edge-detection-sample-size) | Trade edge detection sample size | not open yet |
| [sortino-ratio-returns-calculator](sortino-ratio-returns-calculator) | Sortino ratio from returns | not open yet |
| [calmar-ratio-returns-calculator](calmar-ratio-returns-calculator) | Calmar ratio from returns | not open yet |
| [omega-ratio-returns-calculator](omega-ratio-returns-calculator) | Omega ratio from returns | not open yet |
| [maximum-drawdown-path-calculator](maximum-drawdown-path-calculator) | Maximum drawdown path calculator | not open yet |
| [gambler-ruin-probability-calculator](gambler-ruin-probability-calculator) | Gambler ruin probability calculator | not open yet |

## Conventions

- Sharpe ratios are per period unless a name says annual. Kurtosis is non-excess (a normal distribution has 3).
- Inputs outside a formula's domain, or large enough to overflow double precision, throw a named error. Where a ratio is undefined (no downside, no drawdown), `calculate` in `ten_tools.ts` returns `null`.
- Some identifiers are in French (`courbe` is curve, `cout_seuil` is cost threshold). They match the website's code, so they stay.

## License

MIT. See [LICENSE](LICENSE). `normInv` in `sharpe.ts` follows CPython's implementation of Wichura's AS241 algorithm; its notice is in [NOTICE](NOTICE).

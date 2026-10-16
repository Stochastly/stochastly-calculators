# Two-strategy portfolio Sharpe calculator

Combine two expected returns and volatilities at a declared weight and correlation.

Page: stochastly.com/tools/two-strategy-portfolio-sharpe-calculator (not open yet; this code is published before its page)

## Formula

```
mu = w muA + (1−w) muB; sigma² = w² sigmaA² + (1−w)² sigmaB² + 2w(1−w) rho sigmaA sigmaB; SR = mu/sigma
```

## Example

With returns of 8% and 6%, volatilities of 10% and 12%, zero correlation and equal weights, expected excess return is 7%, volatility is 7.81025% and Sharpe is 0.89626.

## Assumptions

Returns, volatility and correlation refer to the same horizon, currency and excess-return convention. The weights sum to one and remain constant within that horizon.

## Limits

The result uses point estimates. Correlation often changes during stress, and rebalancing, leverage, cost and estimation error are excluded. A zero portfolio variance with a nonzero mean has no finite Sharpe ratio.

## Reference

- Markowitz, H. (1952). Portfolio Selection. Journal of Finance 7(1), 77-91. https://doi.org/10.2307/2975974

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("correlated-portfolio", ...)`.

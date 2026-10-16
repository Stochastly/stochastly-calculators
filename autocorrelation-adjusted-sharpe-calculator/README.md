# Autocorrelation-adjusted Sharpe calculator

Annualize a periodic Sharpe ratio with a stated autocorrelation and horizon using Lo's aggregation identity.

Page: stochastly.com/tools/autocorrelation-adjusted-sharpe-calculator (not open yet; this code is published before its page)

## Formula

```
SR(q) = q × SR(1) / sqrt(q + 2 sum[k=1..q−1] (q−k) rho^k)
```

## Example

For a per-period Sharpe of 0.1, rho = 0, and q = 12, the result is 0.346410. Setting rho = 0.2 reduces it to 0.287885 because adjacent returns move together.

## Assumptions

The model assumes a stationary AR(1) return process whose lag-k correlation is rho to the power k. The periodic mean and variance are treated as known estimates.

## Limits

This is a horizon conversion, not a confidence interval for an estimated Sharpe ratio. An AR(1) model may miss long memory, volatility clustering and changing correlation.

## Reference

- Lo, A. W. (2002). The Statistics of Sharpe Ratios. Financial Analysts Journal 58(4), 36-52. https://doi.org/10.2469/faj.v58.n4.2453

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("serial-sharpe", ...)`.

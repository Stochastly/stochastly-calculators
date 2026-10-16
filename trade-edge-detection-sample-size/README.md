# Trade edge detection sample size

Estimate independent trade count required for a two-sided mean test at declared power.

Page: stochastly.com/tools/trade-edge-detection-sample-size (not open yet; this code is published before its page)

## Formula

```
n = ceil(((z[1−alpha/2] + z[power]) / effect)^2)
```

## Example

For an effect of 0.2 standard deviations, alpha = 0.05 and power = 0.8, the normal approximation gives 197 independent trades.

## Assumptions

Trade returns are independent with a stable finite variance, the standardized true effect is known for planning, and the normal approximation applies. The test is two-sided.

## Limits

This is a prospective power calculation for one declared test. It does not correct for searching many strategies, dependence between trades, heavy tails, or a guessed effect that proves too optimistic. The existing minimum track record length tool addresses Sharpe evidence instead.

## Reference

- NIST/SEMATECH e-Handbook of Statistical Methods, section 7.2.2.2: sample sizes required. https://www.itl.nist.gov/div898/handbook/prc/section2/prc222.htm

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("trade-power", ...)`.

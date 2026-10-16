# Omega ratio from returns

Measure total gains above a threshold against total shortfalls below it from observations.

Live calculator: [stochastly.com/tools/omega-ratio-returns-calculator](https://stochastly.com/tools/omega-ratio-returns-calculator)

## Formula

```
sample Omega(target) = sum(max(r−target,0)) / sum(max(target−r,0))
```

## Example

For 4%, −2%, 3%, −1% and a zero threshold, positive excess sums to 7 points and shortfall sums to 3 points, giving Omega 2.333333.

## Assumptions

The empirical distribution assigns equal mass to every observation. The threshold is in the same percentage units and time interval as the returns.

## Limits

When the sample has no shortfall, Omega is undefined rather than infinite on this page. Observations need a common sampling convention; serial dependence and sampling uncertainty are not quantified.

## Reference

- Keating, C. and Shadwick, W. F. (2002). A Universal Performance Measure. Journal of Performance Measurement 6(3), 59-84. https://web.archive.org/web/20191113054500/http://www.performance-measurement.org/KeatingShadwick2002a.pdf

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("omega", ...)`.

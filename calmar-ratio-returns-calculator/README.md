# Calmar ratio from returns

Compute compounded annual growth and peak-to-trough drawdown from a pasted return path.

Live calculator: [stochastly.com/tools/calmar-ratio-returns-calculator](https://stochastly.com/tools/calmar-ratio-returns-calculator)

## Formula

```
CAGR = product(1+r)^(periods/n)−1; MDD = max(1−wealth/running peak); Calmar = CAGR/MDD
```

## Example

Returns of 10%, −5%, 8%, −2% with four observations per year end at wealth 1.106028. CAGR is 10.6028%, maximum drawdown is 5%, and Calmar is 2.12056.

## Assumptions

The series is chronological, each observation spans the same amount of time and returns are simple percentage returns. Wealth starts at one and the initial point is a peak candidate.

## Limits

A path with no drawdown has no finite Calmar ratio; a total loss makes annual growth undefined. The result is very sensitive to the sample window and the exact order of returns.

## Reference

- Young, T. W. (1991). Calmar Ratio: A Smoother Tool. Futures magazine, October 1991 (trade publication, no DOI). Drawdown context: Magdon-Ismail, M. et al. (2004), On the maximum drawdown of a Brownian motion, Journal of Applied Probability 41(1). https://doi.org/10.1239/jap/1077134674

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("calmar", ...)`.

# Probability of backtest overfitting (PBO) calculator

Combinatorially symmetric cross-validation (CSCV) on a T x K matrix of returns: every split of S blocks into two halves, the in-sample winner, its out-of-sample rank, and the share of splits where that rank falls below the median.

Live calculator: [stochastly.com/tools/probability-of-backtest-overfitting-calculator](https://stochastly.com/tools/probability-of-backtest-overfitting-calculator)

## Formula

```
for each of C(S, S/2) splits: n* = argmax in-sample score; w = rank of n* out of sample / (K + 1)
logit = ln(w / (1 - w)); PBO = share of splits with logit < 0
```

## Limits

At least 4 observations per block (T >= 4S) and two configurations. The estimate is biased upward with few configurations and says nothing about a strategy outside the tried set.

## Reference

- Bailey, D. H., Borwein, J., Lopez de Prado, M. and Zhu, Q. J. (2017). The Probability of Backtest Overfitting. Journal of Computational Finance 20(4). https://doi.org/10.21314/JCF.2016.322

## Files

- `cscv.ts`: shared with 1 other folder, same bytes
- `cscv-csv.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

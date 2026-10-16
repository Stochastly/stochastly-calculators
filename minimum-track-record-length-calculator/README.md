# Minimum track record length calculator

Number of observations, and calendar years, needed before a Sharpe ratio exceeds a benchmark Sharpe ratio at a chosen confidence, with its sensitivity to the Sharpe ratio and to kurtosis.

Live calculator: [stochastly.com/tools/minimum-track-record-length-calculator](https://stochastly.com/tools/minimum-track-record-length-calculator)

## Formula

```
MinTRL = 1 + (1 - g3 SR + (g4 - 1)/4 SR^2) (Phi^-1(c) / (SR - SR*))^2
years = MinTRL / periods per year
```

## Limits

MinTRL exists only when SR exceeds SR*. Returns are assumed independent; serial correlation lengthens the record actually needed.

## Reference

- Bailey, D. H. and Lopez de Prado, M. (2012). The Sharpe Ratio Efficient Frontier. Journal of Risk 15(2). MinTRL: Eq. (13); worked example: Appendix A.3. https://doi.org/10.21314/JOR.2012.255

## Files

- `mintrl.ts`
- `sharpe.ts`: shared with 2 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

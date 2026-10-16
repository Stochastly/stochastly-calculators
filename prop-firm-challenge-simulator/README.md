# Prop firm challenge simulator

Seeded Monte Carlo of a prop firm evaluation: daily returns with a stated drift and volatility, a profit target, a daily loss limit, a static or trailing total loss limit, minimum days and a horizon. Returns pass and fail rates with Wilson intervals, and the closed-form two-barrier probability for comparison.

Live calculator: [stochastly.com/tools/prop-firm-challenge-simulator](https://stochastly.com/tools/prop-firm-challenge-simulator)

## Formula

```
continuous path, no daily rule, no horizon: P(pass) = (1 - exp(2 mu b / sigma^2)) / (exp(-2 mu a / sigma^2) - exp(2 mu b / sigma^2))
zero drift: P(pass) = b / (a + b), a = profit target, b = total loss limit
random numbers: Mulberry32 seed, Box-Muller normals
```

## Limits

Returns are Gaussian and independent from day to day. Consistency rules, news rules and inactivity rules of a real firm are not modelled.

## Reference

- Borodin, A. N. and Salminen, P. (2002). Handbook of Brownian Motion: Facts and Formulae, 2nd ed. Birkhauser. (Exit of Brownian motion with drift from an interval.) https://doi.org/10.1007/978-3-0348-8163-0
- Box, G. E. P. and Muller, M. E. (1958). A Note on the Generation of Random Normal Deviates. Annals of Mathematical Statistics 29(2), 610-611. https://doi.org/10.1214/aoms/1177706645

## Files

- `first_passage.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

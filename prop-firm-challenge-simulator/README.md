# Prop firm challenge simulator

Seeded Monte Carlo of a prop firm evaluation: daily returns with a stated drift and volatility, a profit target, a daily loss limit, a static or trailing total loss limit, minimum days and a horizon. Returns pass and fail rates with Wilson intervals, and the closed-form two-barrier probability for comparison.

Live calculator: [stochastly.com/tools/prop-firm-challenge-simulator](https://stochastly.com/tools/prop-firm-challenge-simulator)

## Formula

```
continuous path, no daily rule, no horizon: P(pass) = (1 - exp(2 mu b / sigma^2)) / (exp(-2 mu a / sigma^2) - exp(2 mu b / sigma^2))
zero drift: P(pass) = b / (a + b), a = profit target, b = total loss limit
random numbers: Mulberry32 seed, Box-Muller normals
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { brownianPassProbability, simulate } from "./first_passage.ts";

// zero drift, 10% target, 5% total loss limit: the closed form is b / (a + b)
console.log(brownianPassProbability(10, 5, 0, 1).toFixed(4)); // 0.3333
const s = simulate({ targetPct: 8, dailyLossPct: 5, totalLossPct: 10, minDays: 5, horizonDays: 120, driftPct: 0.08, volatilityPct: 1.2, simulations: 3000, seed: 20261003, driftSdPct: 0.06 });
console.log(s.counts.pass); // 2155
```

## Limits

Returns are Gaussian and independent from day to day. Consistency rules, news rules and inactivity rules of a real firm are not modelled.

## Reference

- Borodin, A. N. and Salminen, P. (2002). Handbook of Brownian Motion: Facts and Formulae, 2nd ed. Birkhauser. (Exit of Brownian motion with drift from an interval.) https://doi.org/10.1007/978-3-0348-8163-0
- Box, G. E. P. and Muller, M. E. (1958). A Note on the Generation of Random Normal Deviates. Annals of Mathematical Statistics 29(2), 610-611. https://doi.org/10.1214/aoms/1177706645

## Files

- `first_passage.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

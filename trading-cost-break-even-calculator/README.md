# Trading cost break-even calculator

Annual cost drag, net return and net Sharpe ratio from a declared round-trip cost, plus the cost and the trading frequency at which a positive gross return falls to zero.

Live calculator: [stochastly.com/tools/trading-cost-break-even-calculator](https://stochastly.com/tools/trading-cost-break-even-calculator)

## Formula

```
composed bp = (venue round-turn bp + fees and slippage bp) x stress
annual friction (%) = round trips x exposure x composed bp / 100
net return = gross return - annual friction; net Sharpe = net return / volatility
break-even bp = gross return x 100 / (round trips x exposure x stress)
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculateCost } from "./cout_seuil.ts";

const r = calculateCost({ grossReturnPct: 12, volatilityPct: 18, roundTrips: 24, exposure: 1, venueRoundTurnBp: 2, extraRtBp: 1, stress: 1.5 });
console.log(r.netReturnPct.toFixed(2), r.breakEvenBp?.toFixed(2)); // 10.92 33.33
```

## Limits

Arithmetic sensitivity at constant exposure, volatility and cost per trade. Volatility-scaled slippage, fixed per-trade drag and financing (swaps, funding) are left out.

## Reference

- Novy-Marx, R. and Velikov, M. (2016). A Taxonomy of Anomalies and Their Trading Costs. Review of Financial Studies 29(1), 104-147. https://doi.org/10.1093/rfs/hhv063

## Files

- `cout_seuil.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

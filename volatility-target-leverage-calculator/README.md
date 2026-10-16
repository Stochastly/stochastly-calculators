# Volatility target leverage calculator

Translate an estimated volatility and a risk target into a capped exposure multiplier.

Page: stochastly.com/tools/volatility-target-leverage-calculator (not open yet; this code is published before its page)

## Formula

```
raw exposure = target volatility / forecast volatility; exposure = min(raw exposure, cap)
```

## Example

A 12% target divided by a 20% forecast gives exposure 0.6. With a cap of 2, the cap does not bind and the projected volatility under the linear scaling assumption is 12%.

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./ten_tools.ts";

const value = calculate("volatility-target", {"target":"12","forecast":"20","cap":"2"});
console.log(value?.toFixed(6)); // 0.600000
```

## Assumptions

The volatility forecast is measured on the same annual or periodic scale as the target. Volatility is assumed to scale linearly with exposure over the interval.

## Limits

The forecast can fail, and leverage changes the loss distribution as well as measured volatility. This static snapshot does not implement Moreira and Muir's dynamic strategy, its lagging rule, or its transaction costs.

## Reference

- Moreira, A. and Muir, T. (2017). Volatility-Managed Portfolios. Journal of Finance 72(4), 1611-1644. https://doi.org/10.1111/jofi.12513

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("volatility-target", ...)`.

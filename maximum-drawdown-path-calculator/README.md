# Maximum drawdown path calculator

Find the largest observed peak-to-trough loss in a chronological return series.

Page: stochastly.com/tools/maximum-drawdown-path-calculator (not open yet; this code is published before its page)

## Formula

```
wealth[t] = wealth[t−1](1+r[t]); peak[t] = max(peak[t−1],wealth[t]); MDD = max(1−wealth[t]/peak[t])
```

## Example

Starting at one, returns 10%, −20%, 5%, −10% produce wealth 1.1, 0.88, 0.924 and 0.8316. The largest peak-to-trough decline is 24.4%.

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./ten_tools.ts";

const value = calculate("maximum-drawdown", {"returns":"10,-20,5,-10"});
console.log(value?.toFixed(6)); // 0.244000
```

## Assumptions

Inputs are chronological simple returns, with an initial wealth of one. The statistic uses observed close-to-close values only and treats the initial wealth as the first running peak.

## Limits

This is realized maximum drawdown, not Magdon-Ismail's expected drawdown under Brownian motion. Intraperiod lows, future paths and estimation uncertainty do not appear. A return below −100% is invalid for a limited-liability wealth path.

## Reference

- Magdon-Ismail, M., Atiya, A. F., Pratap, A. and Abu-Mostafa, Y. S. (2003). The Maximum Drawdown of the Brownian Motion. IEEE CIFER 2003. https://doi.org/10.1109/CIFER.2003.1196267

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("maximum-drawdown", ...)`.

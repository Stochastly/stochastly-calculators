# Sortino ratio from returns

Compute mean excess return over target divided by downside deviation from pasted observations.

Page: stochastly.com/tools/sortino-ratio-returns-calculator (not open yet; this code is published before its page)

## Formula

```
Sortino = mean(r−target) / sqrt(mean(min(0,r−target)^2))
```

## Example

For returns 4%, −2%, 3%, −1% and target zero, the mean is 1%, downside deviation is sqrt(1.25)% and the Sortino ratio is 0.894427.

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./ten_tools.ts";

const value = calculate("sortino", {"returns":"4,-2,3,-1","target":"0"});
console.log(value?.toFixed(6)); // 0.894427
```

## Assumptions

All returns refer to equal observation intervals and the target is on the same scale. Downside deviation divides by all observations, including those above the target.

## Limits

There is no finite ratio when downside deviation is zero. This is an in-sample description and can become unstable with few losses; it is not an annualized estimate or a confidence bound.

## Reference

- Sortino, F. A. and van der Meer, R. (1991). Downside Risk. Journal of Portfolio Management 17(4), 27-31. https://doi.org/10.3905/jpm.1991.409343

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("sortino", ...)`.

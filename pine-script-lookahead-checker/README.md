# Pine Script look-ahead checker

Scans Pine Script source for request.security (or security) calls that read a higher timeframe with lookahead on and an unshifted expression, the pattern that lets a backtest see the close of a bar before it ends. Strings and comments are ignored.

Live calculator: [stochastly.com/tools/pine-script-lookahead-checker](https://stochastly.com/tools/pine-script-lookahead-checker)

## Formula

```
flag a call when lookahead = barmerge.lookahead_on (named, or the 5th positional argument in Pine v3/v4)
and the requested expression is not offset by [1] or more
```

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { scanPineLookahead } from "./pine_lookahead.ts";

const source = 'c = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_on)';
const scan = scanPineLookahead(source);
console.log(scan.status, scan.findings.length); // potential look-ahead risk 1
```

## Limits

A pattern scanner, not a Pine interpreter. It does not follow variables across files or functions, and a clean scan does not prove a script free of repainting.

## Reference

- TradingView. Pine Script User Manual: Repainting. https://www.tradingview.com/pine-script-docs/v5/concepts/repainting/
- TradingView. Pine Script User Manual: Other timeframes and data. https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/

## Files

- `pine_lookahead.ts`
- `calculation.test.ts`: run with `node --test calculation.test.ts`

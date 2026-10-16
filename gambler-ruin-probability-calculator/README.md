# Gambler ruin probability calculator

Calculate exact eventual ruin probability in a finite fair-or-biased unit-step random walk.

Page: stochastly.com/tools/gambler-ruin-probability-calculator (not open yet; this code is published before its page)

## Formula

```
P(ruin) = (r^i−r^N)/(1−r^N), r=(1−p)/p; for p=0.5, P=1−i/N
```

## Example

At p = 0.5, starting three units from ruin with an upper boundary at ten units, eventual ruin probability is exactly 1−3/10 = 0.7.

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./ten_tools.ts";

const value = calculate("gambler-ruin", {"units":"3","goal":"10","probability":"0.5"});
console.log(value?.toFixed(6)); // 0.700000
```

## Assumptions

Every step changes capital by exactly one unit. Win probability is constant, steps are independent, and the game stops at either zero or the upper boundary.

## Limits

A trading account rarely has constant one-unit wins and losses. There is no time horizon, transaction cost, position sizing, gap risk or changing edge here. A probability of zero or one is handled as a deterministic walk.

## Reference

- Grinstead, C. M. and Snell, J. L. (1997). Introduction to Probability, 2nd ed., American Mathematical Society. Chapter 12, Random Walks. https://chance.dartmouth.edu/teaching_aids/books_articles/probability_book/Chapter12.pdf

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("gambler-ruin", ...)`.

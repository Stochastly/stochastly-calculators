# Fractional Kelly bet calculator

Calculate the log-growth-optimal stake for a binary payoff, then apply an explicit fraction.

Page: stochastly.com/tools/fractional-kelly-bet-calculator (not open yet; this code is published before its page)

## Formula

```
f* = max(0, (b p − (1−p)) / b); applied fraction = c f*
```

## Example

At p = 0.6 and net odds b = 1, full Kelly is 0.2. A half-Kelly setting c = 0.5 gives a stake of 0.1, or 10% of capital.

## Usage

Node.js runs this file as is from 22.18 in the 22 line and from 23.6 onwards (save it in this folder as `example.ts`, then `node example.ts`):

```ts
import { calculate } from "./ten_tools.ts";

const value = calculate("fractional-kelly", {"probability":"0.6","odds":"1","fraction":"0.5"});
console.log(value?.toFixed(6)); // 0.100000
```

## Assumptions

Each trial has two outcomes: gain b times the amount staked or loss of the entire stake. The probability and payoff are fixed and trials are repeatable.

## Limits

A probability estimate is uncertain. The calculator does not estimate that uncertainty, account for changing odds, or certify that any stake is tolerable. At p = 0 or 1 the formula remains algebraic, but the assumption of certainty deserves scrutiny.

## Reference

- Kelly, J. L. (1956). A New Interpretation of Information Rate. Bell System Technical Journal 35(4), 917-926. https://doi.org/10.1002/j.1538-7305.1956.tb03809.x

## Files

- `ten_tools.ts`: shared with 9 other folders, same bytes
- `calculation.test.ts`: run with `node --test calculation.test.ts`

`ten_tools.ts` holds ten calculators. This folder covers `calculate("fractional-kelly", ...)`.

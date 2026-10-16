import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("correlated-portfolio: the value the page prints for its example", () => {
  const got = calculate("correlated-portfolio", {"meanA":"8","volA":"10","meanB":"6","volB":"12","weight":"0.5","correlation":"0"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.89626) < 1e-5, `${got} vs 0.89626`);
});

test("correlated-portfolio: an empty field is refused with its name", () => {
  const input = {"meanA":"8","volA":"10","meanB":"6","volB":"12","weight":"0.5","correlation":"0"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("correlated-portfolio", { ...input, [key]: "" }), new RegExp(key));
});

test("correlated-portfolio: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "correlated-portfolio")?.slug, "two-strategy-portfolio-sharpe-calculator");
});

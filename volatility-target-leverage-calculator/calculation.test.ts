import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("volatility-target: the value the page prints for its example", () => {
  const got = calculate("volatility-target", {"target":"12","forecast":"20","cap":"2"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.6) < 1e-5, `${got} vs 0.6`);
});

test("volatility-target: an empty field is refused with its name", () => {
  const input = {"target":"12","forecast":"20","cap":"2"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("volatility-target", { ...input, [key]: "" }), new RegExp(key));
});

test("volatility-target: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "volatility-target")?.slug, "volatility-target-leverage-calculator");
});

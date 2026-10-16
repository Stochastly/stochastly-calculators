import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("maximum-drawdown: the value the page prints for its example", () => {
  const got = calculate("maximum-drawdown", {"returns":"10,-20,5,-10"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.244) < 1e-5, `${got} vs 0.244`);
});

test("maximum-drawdown: an empty field is refused with its name", () => {
  const input = {"returns":"10,-20,5,-10"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("maximum-drawdown", { ...input, [key]: "" }), new RegExp(key));
});

test("maximum-drawdown: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "maximum-drawdown")?.slug, "maximum-drawdown-path-calculator");
});

import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("fractional-kelly: the value the page prints for its example", () => {
  const got = calculate("fractional-kelly", {"probability":"0.6","odds":"1","fraction":"0.5"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.1) < 1e-5, `${got} vs 0.1`);
});

test("fractional-kelly: an empty field is refused with its name", () => {
  const input = {"probability":"0.6","odds":"1","fraction":"0.5"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("fractional-kelly", { ...input, [key]: "" }), new RegExp(key));
});

test("fractional-kelly: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "fractional-kelly")?.slug, "fractional-kelly-bet-calculator");
});

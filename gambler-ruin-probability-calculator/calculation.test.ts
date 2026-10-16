import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("gambler-ruin: the value the page prints for its example", () => {
  const got = calculate("gambler-ruin", {"units":"3","goal":"10","probability":"0.5"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.7) < 1e-5, `${got} vs 0.7`);
});

test("gambler-ruin: an empty field is refused with its name", () => {
  const input = {"units":"3","goal":"10","probability":"0.5"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("gambler-ruin", { ...input, [key]: "" }), new RegExp(key));
});

test("gambler-ruin: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "gambler-ruin")?.slug, "gambler-ruin-probability-calculator");
});

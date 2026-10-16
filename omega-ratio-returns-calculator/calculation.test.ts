import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("omega: the value the page prints for its example", () => {
  const got = calculate("omega", {"returns":"4,-2,3,-1","target":"0"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 2.333333) < 1e-5, `${got} vs 2.333333`);
});

test("omega: an empty field is refused with its name", () => {
  const input = {"returns":"4,-2,3,-1","target":"0"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("omega", { ...input, [key]: "" }), new RegExp(key));
});

test("omega: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "omega")?.slug, "omega-ratio-returns-calculator");
});

import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("sortino: the value the page prints for its example", () => {
  const got = calculate("sortino", {"returns":"4,-2,3,-1","target":"0"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.894427) < 1e-5, `${got} vs 0.894427`);
});

test("sortino: an empty field is refused with its name", () => {
  const input = {"returns":"4,-2,3,-1","target":"0"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("sortino", { ...input, [key]: "" }), new RegExp(key));
});

test("sortino: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "sortino")?.slug, "sortino-ratio-returns-calculator");
});

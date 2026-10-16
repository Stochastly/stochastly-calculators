import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("calmar: the value the page prints for its example", () => {
  const got = calculate("calmar", {"returns":"10,-5,8,-2","periods":"4"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 2.12056) < 1e-5, `${got} vs 2.12056`);
});

test("calmar: an empty field is refused with its name", () => {
  const input = {"returns":"10,-5,8,-2","periods":"4"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("calmar", { ...input, [key]: "" }), new RegExp(key));
});

test("calmar: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "calmar")?.slug, "calmar-ratio-returns-calculator");
});

import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("trade-power: the value the page prints for its example", () => {
  const got = calculate("trade-power", {"effect":"0.2","alpha":"0.05","power":"0.8"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 197) < 1e-5, `${got} vs 197`);
});

test("trade-power: an empty field is refused with its name", () => {
  const input = {"effect":"0.2","alpha":"0.05","power":"0.8"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("trade-power", { ...input, [key]: "" }), new RegExp(key));
});

test("trade-power: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "trade-power")?.slug, "trade-edge-detection-sample-size");
});

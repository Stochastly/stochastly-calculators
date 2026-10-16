import test from "node:test";
import assert from "node:assert/strict";
import { calculate, tools } from "./ten_tools.ts";

test("serial-sharpe: the value the page prints for its example", () => {
  const got = calculate("serial-sharpe", {"sharpe":"0.1","rho":"0.2","periods":"12"});
  assert.ok(got !== null);
  assert.ok(Math.abs(got - 0.287885) < 1e-5, `${got} vs 0.287885`);
});

test("serial-sharpe: an empty field is refused with its name", () => {
  const input = {"sharpe":"0.1","rho":"0.2","periods":"12"};
  for (const key of Object.keys(input)) assert.throws(() => calculate("serial-sharpe", { ...input, [key]: "" }), new RegExp(key));
});

test("serial-sharpe: the tool is published under this folder's name", () => {
  assert.equal(tools.find(t => t.id === "serial-sharpe")?.slug, "autocorrelation-adjusted-sharpe-calculator");
});

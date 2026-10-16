import test from "node:test";
import assert from "node:assert/strict";
import { PINE_EXAMPLE, scanPineLookahead } from "./pine_lookahead.ts";

const flagged = [
  `//@version=6\nx = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_on)`,
  `x = request.security(\n syminfo.tickerid,\n "1D",\n high,\n lookahead = barmerge.lookahead_on\n)`,
  `x = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_on)[1]`,
  `//@version=4\nx = security(syminfo.tickerid, "D", close, barmerge.gaps_off, barmerge.lookahead_on)`,
  `x = request.security(syminfo.tickerid, "1D", close + open[1], lookahead=barmerge.lookahead_on)`,
];
const clean = [
  `x = request.security(syminfo.tickerid, "1D", close[1], lookahead=barmerge.lookahead_on)`,
  `x = request.security(syminfo.tickerid, "1D", (close + open)[1], lookahead=barmerge.lookahead_on)`,
  `x = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_off)`,
  `// x = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_on)`,
  `label.new(bar_index, high, 'request.security(s, "D", close, lookahead=barmerge.lookahead_on)')`,
];

test("look-ahead patterns are flagged", () => {
  for (const s of flagged) assert.ok(scanPineLookahead(s).findings.length > 0, s);
});

test("shifted expressions, lookahead off, comments and strings are not", () => {
  for (const s of clean) assert.equal(scanPineLookahead(s).findings.length, 0, s);
});

test("the example on the page is flagged with a line number", () => {
  const f = scanPineLookahead(PINE_EXAMPLE).findings;
  assert.ok(f.length > 0);
  assert.ok(f.every(x => Number.isInteger(x.line) && x.line > 0));
});

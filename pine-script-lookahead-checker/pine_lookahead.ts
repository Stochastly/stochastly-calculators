export const PINE_EXAMPLE = `//@version=6
indicator("HTF close example", overlay=true)
dailyClose = request.security(syminfo.tickerid, "1D", close, lookahead=barmerge.lookahead_on)
plot(dailyClose)`;

export type PineFinding = {
  line: number;
  excerpt: string;
  rule: string;
  falsePositives: string;
};

export type PineScan = {
  status: "potential look-ahead risk" | "no pattern matched (static scan, partial recall)";
  findings: PineFinding[];
  message?: string;
};

// Preserve offsets and newlines while hiding strings and comments from structural matching.
function maskSource(source: string): { mask: string; error?: string } {
  let mask = "";
  let state: "code" | "line" | "block" | "single" | "double" = "code";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") { mask += "  "; i++; state = "line"; continue; }
      if (c === "/" && next === "*") { mask += "  "; i++; state = "block"; continue; }
      if (c === "'" || c === '"') { mask += " "; state = c === "'" ? "single" : "double"; continue; }
      mask += c;
    } else if (state === "line") {
      mask += c === "\n" ? "\n" : " ";
      if (c === "\n") state = "code";
    } else if (state === "block") {
      if (c === "*" && next === "/") { mask += "  "; i++; state = "code"; }
      else mask += c === "\n" ? "\n" : " ";
    } else {
      if (c === "\\" && next !== undefined) { mask += "  "; i++; continue; }
      mask += c === "\n" ? "\n" : " ";
      if ((state === "single" && c === "'") || (state === "double" && c === '"')) state = "code";
    }
  }
  return { mask, error: state === "block" || state === "single" || state === "double" ? "Unterminated comment or string; results may be incomplete." : undefined };
}

function matchingClose(mask: string, open: number): number {
  const stack = [")"];
  const closes: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (let i = open + 1; i < mask.length; i++) {
    const c = mask[i];
    if (closes[c]) stack.push(closes[c]);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function argumentsOf(mask: string, start: number, end: number): Array<[number, number]> {
  const args: Array<[number, number]> = [];
  const stack: string[] = [];
  const closes: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  let from = start;
  for (let i = start; i < end; i++) {
    const c = mask[i];
    if (closes[c]) stack.push(closes[c]);
    else if (c === ")" || c === "]" || c === "}") stack.pop();
    else if (c === "," && stack.length === 0) { args.push([from, i]); from = i + 1; }
  }
  args.push([from, end]);
  return args;
}

function assignedArgument(mask: string, span: [number, number], name: string): string | null {
  const value = mask.slice(...span);
  const match = value.match(new RegExp(`^\\s*${name}\\s*=\\s*([\\s\\S]*)$`));
  return match ? match[1].trim() : null;
}

// An offset on the returned series (request.security(...)[1]) is not an expression offset.
// Recognise simple direct history references and tuples whose members all have one.
function directlyOffset(expression: string): boolean {
  const e = expression.trim();
  if (/^\[[\s\S]*\]$/.test(e)) {
    const members = argumentsOf(e, 1, e.length - 1);
    return members.length > 0 && members.every(([a, b]) => directlyOffset(e.slice(a, b)));
  }
  return /\[\s*[1-9]\d*\s*\]$/.test(e);
}

export function scanPineLookahead(source: string): PineScan {
  const { mask, error } = maskSource(source);
  const findings: PineFinding[] = [];
  const invalid: string[] = error ? [error] : [];
  const delimiters: string[] = [];
  const closing: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (const c of mask) {
    if (closing[c]) delimiters.push(closing[c]);
    else if ((c === ")" || c === "]" || c === "}") && delimiters.pop() !== c) {
      invalid.push("Unbalanced delimiters; results may be incomplete.");
      break;
    }
  }
  if (delimiters.length) invalid.push("Unbalanced delimiters; results may be incomplete.");
  const version = source.match(/^\s*\/\/\s*@version\s*=\s*([12])\b/m)?.[1];
  const calls = /\b(request\.security|security)\s*\(/g;
  for (const match of mask.matchAll(calls)) {
    const open = match.index + match[0].length - 1;
    const close = matchingClose(mask, open);
    if (close < 0) { invalid.push(`Unbalanced call at line ${source.slice(0, match.index).split("\n").length}; results may be incomplete.`); continue; }
    const spans = argumentsOf(mask, open + 1, close);
    const namedExpression = spans.map(s => assignedArgument(mask, s, "expression")).find(v => v !== null);
    const expression = namedExpression ?? (spans[2] ? mask.slice(...spans[2]).trim() : "");
    const namedLookahead = spans.map(s => assignedArgument(mask, s, "lookahead")).find(v => v !== null);
    // Pine v3/v4 pass lookahead positionally as the 5th argument (positional arguments precede named ones).
    const fifth = spans[4] ? mask.slice(...spans[4]).trim() : undefined;
    const lookahead = namedLookahead ?? (fifth !== undefined && !/^[A-Za-z_]\w*\s*=(?!=)/.test(fifth) ? fifth : undefined);
    const oldDefault = match[1] === "security" && (version === "1" || version === "2") && lookahead === undefined;
    if (!oldDefault && lookahead !== "barmerge.lookahead_on") continue;
    if (directlyOffset(expression)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    findings.push({
      line,
      excerpt: source.slice(match.index, close + 1).replace(/\s+/g, " ").slice(0, 220),
      rule: oldDefault ? "Pine v1/v2 security() uses historical lookahead behavior when requesting higher timeframe data." : "security() with lookahead_on and no explicit expression history offset can leak higher timeframe values into historical bars.",
      falsePositives: "Same or lower timeframe requests, an offset inside a helper or intermediate variable, or a non-price expression can require manual review.",
    });
  }
  return {
    status: findings.length ? "potential look-ahead risk" : "no pattern matched (static scan, partial recall)",
    findings,
    message: invalid.length ? [...new Set(invalid)].join(" ") : undefined,
  };
}

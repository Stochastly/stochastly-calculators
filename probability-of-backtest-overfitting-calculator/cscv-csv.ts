import { CSCVError } from "./cscv.ts";

export function parseMatrixCSV(text: string): { matrix: number[][]; names: string[] } {
  const cells: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell.trim()) throw new CSCVError("matrix", "a quote must begin a CSV cell");
      else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\n" || ch === "\r")) {
      row.push(cell.trim()); cell = "";
      if (ch !== ",") {
        if (row.some(value => value !== "")) cells.push(row);
        row = [];
        if (ch === "\r" && input[i + 1] === "\n") i++;
      }
    } else cell += ch;
  }
  if (quoted) throw new CSCVError("matrix", "close the quoted CSV cell");
  row.push(cell.trim());
  if (row.some(value => value !== "")) cells.push(row);
  if (!cells.length) throw new CSCVError("matrix", "paste CSV rows of returns");
  const numeric = (row: string[]) => row.every(cell => cell !== "" && Number.isFinite(Number(cell)));
  if (cells[0].some(value => /^(?:[-+]?infinity|nan)$/i.test(value))) throw new CSCVError("matrix", "CSV contains a non-finite return in row 1");
  const header = !numeric(cells[0]);
  const names = header ? cells.shift()! : cells[0].map((_, i) => `Configuration ${i + 1}`);
  if (names.some(name => !name)) throw new CSCVError("matrix", "header names cannot be empty");
  const matrix = cells.map((row, i) => {
    if (row.length !== names.length || !numeric(row)) throw new CSCVError("matrix", `CSV row ${i + (header ? 2 : 1)} must contain ${names.length} finite returns`);
    return row.map(Number);
  });
  return { matrix, names };
}

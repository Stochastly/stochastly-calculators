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
  // 16/10 (test of the public repository): a matrix exported with its date column, the form /check accepts, was
  // refused as "row 2 must contain K finite returns". A first column of ISO dates (YYYY-MM-DD, optional time and
  // UTC offset) on every data row is a date column: it is dropped. When it has a header cell, that first row IS the
  // header even if the remaining names are numbers ("date,10,20": configurations named 10 and 20, review 16/10).
  const isoDate = /^\d{4}[-/]\d{2}[-/]\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const firstIsDate = isoDate.test(cells[0][0] ?? "");
  const dataRows = cells.slice(firstIsDate ? 0 : 1);
  const dateColumn = cells[0].length >= 2 && dataRows.length > 0 && dataRows.every(row => isoDate.test(row[0] ?? ""));
  if (dateColumn) for (const row of cells) row.shift();
  const numeric = (row: string[]) => row.every(cell => cell !== "" && Number.isFinite(Number(cell)));
  if (!(dateColumn && !firstIsDate) && cells[0].some(value => /^(?:[-+]?infinity|nan)$/i.test(value))) throw new CSCVError("matrix", "CSV contains a non-finite return in row 1");
  const header = dateColumn ? !firstIsDate : !numeric(cells[0]);
  const names = header ? cells.shift()! : cells[0].map((_, i) => `Configuration ${i + 1}`);
  if (names.some(name => !name)) throw new CSCVError("matrix", "header names cannot be empty");
  const matrix = cells.map((row, i) => {
    if (row.length !== names.length || !numeric(row)) throw new CSCVError("matrix", `CSV row ${i + (header ? 2 : 1)} must contain ${names.length} finite returns`);
    return row.map(Number);
  });
  return { matrix, names };
}

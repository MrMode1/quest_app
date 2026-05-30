import { promises as fs } from "fs";
import path from "path";
import { createRequire } from "module";
import * as XLSX from "xlsx";

// pdf-parse is CommonJS; load it via createRequire so it works under ESM.
const require = createRequire(import.meta.url);

/**
 * Extracts plain text from an uploaded quote file so it can be handed to the AI.
 * Supports PDF, Excel (.xlsx/.xls), CSV, and a utf-8 fallback for everything else.
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const pdf = require("pdf-parse");
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);
    return data.text;
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      parts.push(`# Sheet: ${sheetName}`);
      parts.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return parts.join("\n\n");
  }

  if (ext === ".csv") {
    return fs.readFile(filePath, "utf-8");
  }

  // Fallback: treat as utf-8 text.
  return fs.readFile(filePath, "utf-8");
}

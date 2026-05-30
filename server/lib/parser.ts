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
export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") {
    const pdf = require("pdf-parse");
    const data = await pdf(buffer);
    return data.text;
  }

  if (ext === ".xlsx" || ext === ".xls") {
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
    return buffer.toString("utf-8");
  }

  return buffer.toString("utf-8");
}

/** Disk-based helper used by local/Railway deployments. */
export async function extractText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return extractTextFromBuffer(buffer, path.basename(filePath));
}

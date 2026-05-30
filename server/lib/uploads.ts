import { promises as fs } from "fs";
import path from "path";
import type { Quote } from "@shared/schema";
import { isVercel } from "./env";
import { storage } from "../storage";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

async function ensureUploadDir() {
  if (isVercel) return;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/** Persist an uploaded file to disk (Railway/local) or the database (Vercel). */
export async function saveUpload(quoteId: number, buffer: Buffer, filename: string): Promise<void> {
  if (isVercel) {
    await storage.setQuoteFileData(quoteId, buffer.toString("base64"));
    return;
  }

  await ensureUploadDir();
  const dest = path.join(UPLOAD_DIR, `${quoteId}_${filename}`);
  await fs.writeFile(dest, buffer);
}

/** Load upload bytes for AI extraction. */
export async function loadUpload(quote: Quote): Promise<{ buffer: Buffer; filename: string }> {
  if (quote.fileData) {
    return { buffer: Buffer.from(quote.fileData, "base64"), filename: quote.filename };
  }

  await ensureUploadDir();
  const files = await fs.readdir(UPLOAD_DIR);
  const match = files.find((f) => f.startsWith(`${quote.id}_`));
  if (!match) throw new Error(`No uploaded file found for quote ${quote.id}`);

  const filePath = path.join(UPLOAD_DIR, match);
  const buffer = await fs.readFile(filePath);
  return { buffer, filename: quote.filename };
}

/** Best-effort cleanup when a quote is deleted. */
export async function deleteUpload(quote: Quote): Promise<void> {
  if (quote.fileData || isVercel) return;

  await ensureUploadDir();
  const files = await fs.readdir(UPLOAD_DIR);
  const match = files.find((f) => f.startsWith(`${quote.id}_`));
  if (match) await fs.unlink(path.join(UPLOAD_DIR, match)).catch(() => {});
}

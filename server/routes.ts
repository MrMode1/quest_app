import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { promises as fs } from "fs";
import path from "path";
import multer from "multer";
import { storage } from "./storage";
import { extractText } from "./lib/parser";
// Default AI provider is Claude. To use OpenAI instead, swap this import to "./lib/openai".
import { parseQuoteWithAI } from "./lib/ai";
import { buildQuestivityExcel, questivityFilename } from "./lib/excel-export";
import { insertQuoteItemSchema, type InsertQuoteItem } from "@shared/schema";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function toNumericString(v: number | undefined | null): string | null {
  return v === undefined || v === null ? null : String(v);
}

/** Locate the uploaded file for a quote by its "{id}_*" prefix. */
async function findUploadForQuote(id: number): Promise<string | null> {
  await ensureUploadDir();
  const files = await fs.readdir(UPLOAD_DIR);
  const match = files.find((f) => f.startsWith(`${id}_`));
  return match ? path.join(UPLOAD_DIR, match) : null;
}

/**
 * Runs AI extraction for a quote. Used both by POST /api/quotes/:id/process and
 * by the automatic 1-second trigger after upload.
 */
export async function processQuote(id: number): Promise<void> {
  const quote = await storage.getQuote(id);
  if (!quote) return;
  // Guard: don't double-process.
  if (quote.status === "processing") return;

  try {
    await storage.setQuoteStatus(id, "processing");

    const filePath = await findUploadForQuote(id);
    if (!filePath) throw new Error(`No uploaded file found for quote ${id}`);

    const text = await extractText(filePath);
    const parsedItems = await parseQuoteWithAI(text);

    await storage.clearQuoteItems(id);

    const rows: InsertQuoteItem[] = parsedItems.map((it) => {
      const qty = it.quantity ?? 1;
      const list = it.listPrice;
      const disc = it.discountedPrice;
      const extList = it.extendedListPrice ?? (list != null ? qty * list : undefined);
      const extDisc = it.extendedDiscountedPrice ?? (disc != null ? qty * disc : undefined);
      return {
        quoteId: id,
        partNumber: it.partNumber ?? null,
        description: it.description ?? null,
        eligibilityPercent: it.eligibilityPercent ?? 100,
        quantity: qty,
        listPrice: toNumericString(list),
        extendedListPrice: toNumericString(extList),
        discountedPrice: toNumericString(disc),
        extendedDiscountedPrice: toNumericString(extDisc),
        manufacturer: it.manufacturer ?? null,
        confidence: null,
        originalText: null,
      };
    });

    await storage.createQuoteItems(rows);
    await storage.setQuoteStatus(id, "reviewed");
  } catch (err) {
    console.error(`[process] quote ${id} failed:`, err);
    await storage.setQuoteStatus(id, "error");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureUploadDir();

  // List all quotes (newest first)
  app.get("/api/quotes", async (_req: Request, res: Response) => {
    const quotes = await storage.listQuotes();
    res.json(quotes);
  });

  // Get a quote + its items
  app.get("/api/quotes/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    const items = await storage.getQuoteItems(id);
    res.json({ quote, items });
  });

  // Upload a file -> create quote -> auto-process after 1s
  app.post("/api/quotes", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded (field 'file')" });

      const quote = await storage.createQuote({
        filename: req.file.originalname,
        originalContent: null,
      });

      const dest = path.join(UPLOAD_DIR, `${quote.id}_${req.file.originalname}`);
      await fs.writeFile(dest, req.file.buffer);

      res.status(201).json(quote);

      // Automatically trigger AI processing ~1 second after upload.
      setTimeout(() => {
        processQuote(quote.id).catch((e) => console.error("[auto-process]", e));
      }, 1000);
    } catch (err) {
      console.error("[upload] failed:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Manually (re)trigger AI processing
  app.post("/api/quotes/:id/process", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    if (quote.status === "processing") {
      return res.json({ message: "Already processing", quote });
    }
    // Fire and forget; client polls for status.
    processQuote(id).catch((e) => console.error("[process]", e));
    res.json({ message: "Processing started" });
  });

  // Update a single line item (partial)
  app.put("/api/quotes/:quoteId/items/:itemId", async (req: Request, res: Response) => {
    const quoteId = Number(req.params.quoteId);
    const itemId = Number(req.params.itemId);

    const patchSchema = insertQuoteItemSchema.partial();
    const result = patchSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid item", errors: result.error.flatten() });
    }

    const updated = await storage.updateQuoteItem(quoteId, itemId, result.data);
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  });

  // Export styled Excel
  app.get("/api/quotes/:id/export", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    const items = await storage.getQuoteItems(id);

    const buffer = await buildQuestivityExcel(quote, items);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${questivityFilename(id)}"`,
    );
    res.send(buffer);
  });

  // Delete a quote and its items
  app.delete("/api/quotes/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await storage.deleteQuote(id);
    // Best-effort cleanup of the uploaded file.
    const filePath = await findUploadForQuote(id);
    if (filePath) await fs.unlink(filePath).catch(() => {});
    res.json({ message: "Deleted" });
  });

  return createServer(app);
}

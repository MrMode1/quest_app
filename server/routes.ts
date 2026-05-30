import type { Express, Request, Response } from "express";
import multer from "multer";
import { storage } from "./storage";
import { extractTextFromBuffer } from "./lib/parser";
import { deleteUpload, loadUpload, saveUpload } from "./lib/uploads";
// Default AI provider is Claude. To use OpenAI instead, swap this import to "./lib/openai".
import { parseQuoteWithAI } from "./lib/ai";
import { buildQuestivityExcel, questivityFilename } from "./lib/excel-export";
import { insertQuoteItemSchema, type InsertQuoteItem } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function toNumericString(v: number | undefined | null): string | null {
  return v === undefined || v === null ? null : String(v);
}

/**
 * Runs AI extraction for a quote. Used by POST /api/quotes/:id/process and
 * auto-triggered from the client after upload.
 */
export async function processQuote(id: number): Promise<void> {
  const quote = await storage.getQuote(id);
  if (!quote) return;
  if (quote.status === "processing") return;

  try {
    await storage.setQuoteStatus(id, "processing");

    const { buffer, filename } = await loadUpload(quote);
    const text = await extractTextFromBuffer(buffer, filename);
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
    await storage.setQuoteStatus(id, "error").catch((e) =>
      console.error(`[process] failed to set error status for quote ${id}:`, e),
    );
  }
}

export function registerRoutes(app: Express): void {
  app.get("/api/quotes", async (_req: Request, res: Response) => {
    try {
      const quotes = await storage.listQuotes();
      res.json(quotes);
    } catch (err) {
      console.error("[GET /api/quotes] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to list quotes" });
    }
  });

  app.get("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const items = await storage.getQuoteItems(id);
      res.json({ quote, items });
    } catch (err) {
      console.error("[GET /api/quotes/:id] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get quote" });
    }
  });

  app.post("/api/quotes", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("[upload] multer error:", err);
        return res.status(400).json({ message: err.message || "Invalid upload" });
      }
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded (field 'file')" });

      const quote = await storage.createQuote({
        filename: req.file.originalname,
        originalContent: null,
      });

      await saveUpload(quote.id, req.file.buffer, req.file.originalname);
      res.status(201).json(quote);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[upload] failed:", err);
      res.status(500).json({ message });
    }
  });

  app.post("/api/quotes/:id/process", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      if (quote.status === "processing") {
        return res.json({ message: "Already processing", quote });
      }

      await processQuote(id);
      const updated = await storage.getQuote(id);
      res.json({ message: "Processing complete", quote: updated });
    } catch (err) {
      console.error("[POST /api/quotes/:id/process] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Processing failed" });
    }
  });

  app.put("/api/quotes/:quoteId/items/:itemId", async (req: Request, res: Response) => {
    try {
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
    } catch (err) {
      console.error("[PUT /api/quotes/:quoteId/items/:itemId] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Update failed" });
    }
  });

  app.get("/api/quotes/:id/export", async (req: Request, res: Response) => {
    try {
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
    } catch (err) {
      console.error("[GET /api/quotes/:id/export] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Export failed" });
    }
  });

  app.delete("/api/quotes/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const quote = await storage.getQuote(id);
      await storage.deleteQuote(id);
      if (quote) await deleteUpload(quote);
      res.json({ message: "Deleted" });
    } catch (err) {
      console.error("[DELETE /api/quotes/:id] failed:", err);
      res.status(500).json({ message: err instanceof Error ? err.message : "Delete failed" });
    }
  });
}

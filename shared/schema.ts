import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalContent: text("original_content"),
  /** Base64-encoded upload bytes — used on Vercel where disk storage is ephemeral. */
  fileData: text("file_data"),
  status: text("status").notNull().default("pending"), // pending | processing | reviewed | error
  createdAt: timestamp("created_at").defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
  partNumber: text("part_number"),
  description: text("description"),
  eligibilityPercent: integer("eligibility_percent").default(100),
  quantity: integer("quantity").default(1),
  listPrice: numeric("list_price"),
  extendedListPrice: numeric("extended_list_price"),
  discountedPrice: numeric("discounted_price"),
  extendedDiscountedPrice: numeric("extended_discounted_price"),
  manufacturer: text("manufacturer"),
  confidence: numeric("confidence"),
  originalText: text("original_text"),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, status: true });
export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true });

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

export const parsedQuoteSchema = z.object({
  items: z.array(
    z.object({
      partNumber: z.string().optional(),
      description: z.string().optional(),
      eligibilityPercent: z.number().optional().default(100),
      quantity: z.number().optional(),
      listPrice: z.number().optional(),
      extendedListPrice: z.number().optional(),
      discountedPrice: z.number().optional(),
      extendedDiscountedPrice: z.number().optional(),
      manufacturer: z.string().optional(),
    }),
  ),
});

export type ParsedQuote = z.infer<typeof parsedQuoteSchema>;
export type ParsedQuoteItem = ParsedQuote["items"][number];

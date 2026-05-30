import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  quotes,
  quoteItems,
  type Quote,
  type QuoteItem,
  type InsertQuote,
  type InsertQuoteItem,
} from "@shared/schema";

export interface IStorage {
  listQuotes(): Promise<Quote[]>;
  getQuote(id: number): Promise<Quote | undefined>;
  createQuote(data: InsertQuote): Promise<Quote>;
  setQuoteStatus(id: number, status: string): Promise<void>;
  setQuoteFileData(id: number, fileData: string): Promise<void>;
  deleteQuote(id: number): Promise<void>;
  getQuoteItems(quoteId: number): Promise<QuoteItem[]>;
  clearQuoteItems(quoteId: number): Promise<void>;
  createQuoteItems(items: InsertQuoteItem[]): Promise<QuoteItem[]>;
  updateQuoteItem(
    quoteId: number,
    itemId: number,
    patch: Partial<InsertQuoteItem>,
  ): Promise<QuoteItem | undefined>;
}

class DbStorage implements IStorage {
  async listQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: number): Promise<Quote | undefined> {
    const rows = await db.select().from(quotes).where(eq(quotes.id, id));
    return rows[0];
  }

  async createQuote(data: InsertQuote): Promise<Quote> {
    const rows = await db.insert(quotes).values(data).returning();
    return rows[0];
  }

  async setQuoteStatus(id: number, status: string): Promise<void> {
    await db.update(quotes).set({ status }).where(eq(quotes.id, id));
  }

  async setQuoteFileData(id: number, fileData: string): Promise<void> {
    await db.update(quotes).set({ fileData }).where(eq(quotes.id, id));
  }

  async deleteQuote(id: number): Promise<void> {
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async getQuoteItems(quoteId: number): Promise<QuoteItem[]> {
    return db
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .orderBy(quoteItems.id);
  }

  async clearQuoteItems(quoteId: number): Promise<void> {
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async createQuoteItems(items: InsertQuoteItem[]): Promise<QuoteItem[]> {
    if (items.length === 0) return [];
    return db.insert(quoteItems).values(items).returning();
  }

  async updateQuoteItem(
    quoteId: number,
    itemId: number,
    patch: Partial<InsertQuoteItem>,
  ): Promise<QuoteItem | undefined> {
    const rows = await db
      .update(quoteItems)
      .set(patch)
      .where(and(eq(quoteItems.id, itemId), eq(quoteItems.quoteId, quoteId)))
      .returning();
    return rows[0];
  }
}

export const storage: IStorage = new DbStorage();

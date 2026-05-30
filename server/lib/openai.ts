import OpenAI from "openai";
import { parsedQuoteSchema } from "@shared/schema";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function parseQuoteWithAI(text: string) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert data extraction assistant. Extract structured quote line items from a distributor quote into the Questivity Quote Format.
        IMPORTANT: Return a JSON object with key "items" containing an array.
        Fields: partNumber (SKU), description, eligibilityPercent (E-Rate %, default 100),
        quantity, listPrice (MSRP), extendedListPrice (qty*list), discountedPrice (unit net price),
        extendedDiscountedPrice (qty*disc), manufacturer.
        All price fields must be numbers (no $ symbols).`,
      },
      {
        role: "user",
        content: `Extract items from this quote as JSON with "items" key:\n\n${text.substring(0, 15000)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!items) throw new Error("AI response missing 'items' array");
  return parsedQuoteSchema.parse({ items }).items;
}

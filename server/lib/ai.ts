import Anthropic from "@anthropic-ai/sdk";
import { parsedQuoteSchema } from "@shared/schema";

/**
 * Claude-based quote extractor (default AI provider per the "Claude AI" tech stack).
 *
 * The extraction contract is identical to the OpenAI version: it returns a
 * JSON object with an "items" array, validated by parsedQuoteSchema. To switch
 * back to OpenAI, change the import in server/routes.ts from "./lib/ai" to
 * "./lib/openai" (both export `parseQuoteWithAI`).
 */
// Lazy init so a missing key fails at call time (caught by processQuote), not at module load.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert data extraction assistant. Extract structured quote line items from a distributor quote into the Questivity Quote Format.
IMPORTANT: Return ONLY a JSON object with key "items" containing an array. No prose, no markdown, no code fences.
Fields: partNumber (SKU), description, eligibilityPercent (E-Rate %, default 100),
quantity, listPrice (MSRP), extendedListPrice (qty*list), discountedPrice (unit net price),
extendedDiscountedPrice (qty*disc), manufacturer.
All price fields must be numbers (no $ symbols).`;

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function parseQuoteWithAI(text: string) {
  const controller = new AbortController();
  // Abort well before Vercel's 60s function limit so the catch block in
  // processQuote always runs and sets status → "error" instead of leaving
  // it stuck at "processing".
  const timeoutId = setTimeout(() => controller.abort(), 50_000);

  let response: Awaited<ReturnType<typeof getAnthropic>["messages"]["create"]>;
  try {
    response = await getAnthropic().messages.create(
      {
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract items from this quote as JSON with "items" key:\n\n${text.substring(0, 15000)}`,
          },
        ],
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!items) throw new Error("AI response missing 'items' array");
  return parsedQuoteSchema.parse({ items }).items;
}

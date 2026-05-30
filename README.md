# Questivity Quote Converter

Converts distributor quote files (PDF, Excel, CSV, TXT) into a standardized
**Questivity Quote** format using AI, with a styled Excel export.

- **Frontend:** React + TypeScript, Vite, Wouter, TanStack React Query, shadcn/ui, Tailwind
- **Backend:** Express + TypeScript (run with `tsx`)
- **Database:** PostgreSQL via Drizzle ORM + drizzle-zod
- **AI:** Claude (Anthropic) — see note below
- **Parsing:** `pdf-parse`, `xlsx`, `csv-parse` · **Export:** `exceljs`

> **AI provider note.** The tech-stack spec lists **Claude AI**, so the default
> extractor (`server/lib/ai.ts`) uses the Anthropic SDK and `ANTHROPIC_API_KEY`.
> The original OpenAI implementation is preserved at `server/lib/openai.ts`. To
> switch back to OpenAI, change one import in `server/routes.ts`:
> `import { parseQuoteWithAI } from "./lib/ai"` → `"./lib/openai"`, and set
> `OPENAI_API_KEY` instead.

## Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database
- An Anthropic API key (or OpenAI key if you switch providers)

## Setup

```bash
npm install
cp .env.example .env        # then fill in the values
npm run db:push             # create tables from shared/schema.ts
```

`.env` keys:

```
DATABASE_URL=postgresql://user:password@localhost:5432/questivity
ANTHROPIC_API_KEY=sk-ant-...
SESSION_SECRET=some-long-random-string
# OPENAI_API_KEY=sk-...     # only if using the OpenAI extractor
```

## Run

```bash
npm run dev      # Express + Vite (HMR) on http://localhost:5000
```

Production:

```bash
npm run build    # Vite -> dist/public, esbuild -> dist/index.js (ESM)
npm start
```

## How it works

1. **Upload** (`/quotes/new`): drag/drop a file — it uploads immediately and the
   server kicks off AI extraction automatically ~1 second later.
2. **Processing**: the quote detail page polls every 3 seconds while the status is
   `pending`/`processing`.
3. **Review** (`/quotes/:id`): edit line items inline; extended prices recalc on save.
4. **Export**: server-side styled `.xlsx` (ExcelJS) or client-side `.csv`.

### Excel export details

10 columns A–J (Item #, Part #, Description, E-Rate Eligibility %, Qty, List Price,
Extended List Price, Discounted Price, Markup %, Extended Discounted Price), Arial 7,
teal `#007878` header, a `Hardware/License and Support` section row, a subtotal row,
a notes/totals block, and a black **GRAND TOTAL** row. The **Markup %** column is left
blank for staff to fill in, and **Extended Discounted Price** is a live Excel formula:
`=H{row}*(1+IF(I{row}="",0,I{row}))*E{row}`.

## Project layout

```
client/   React frontend (pages, components, hooks, ui)
server/   Express API, AI + parsing + Excel libs
shared/   Drizzle schema + zod types (imported by both sides)
script/   build.ts (Vite + esbuild)
```

Path aliases: `@/ → client/src/`, `@shared/ → shared/`.

## API

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/api/quotes` | List quotes (newest first) |
| GET | `/api/quotes/:id` | Quote + its items |
| POST | `/api/quotes` | Upload file (multipart `file`); auto-processes |
| POST | `/api/quotes/:id/process` | (Re)run AI extraction |
| PUT | `/api/quotes/:quoteId/items/:itemId` | Partial update of a line item |
| GET | `/api/quotes/:id/export` | Download styled `.xlsx` |
| DELETE | `/api/quotes/:id` | Delete quote + items |
```

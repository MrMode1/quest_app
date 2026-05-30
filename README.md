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
npm run build    # Vite -> public/, esbuild -> dist/index.js (ESM)
npm start
```

## Deploy on Vercel

The repo supports Vercel serverless via `api/index.ts` + `vercel.json`.

**How it differs from Railway:**
- Uploads are stored in Postgres (`file_data` column), not on disk
- AI processing runs inside the `/api/quotes/:id/process` request (60s max on Pro)
- Static React build is served from `public/`; API hits the Express serverless function

### 1. Push to GitHub

Ensure the latest code (including `vercel.json`) is on `main`.

### 2. Create a hosted PostgreSQL database

Vercel does not include Postgres. Use [Neon](https://neon.tech), Supabase, or
[Vercel Postgres](https://vercel.com/storage/postgres).

Run migrations once from your machine:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

### 3. Import on Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import `quest_app`
2. Vercel reads `vercel.json`:
   - **Build:** `npm run build`
   - **Output:** `public/`
   - **API:** `api/index.ts` (Express, 60s timeout)
3. **Environment variables:**

| Variable | Value |
| -------- | ----- |
| `DATABASE_URL` | Neon/Supabase connection string (`?sslmode=require` for Neon) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SESSION_SECRET` | Long random string |

4. Deploy → open the generated `*.vercel.app` URL

### 4. Verify

Upload a quote → you should land on the detail page → processing starts
automatically → line items appear when done.

### Vercel notes

- **Hobby plan** functions timeout at **10s** — AI extraction may fail on large
  PDFs. Use **Pro** (60s) or deploy on Railway for long-running jobs.
- Re-run `npm run db:push` whenever `shared/schema.ts` changes.

## Deploy on Railway

This app is a single Node process (Express + static React build). Railway is a
good fit: persistent disk for uploads, no serverless timeouts for AI parsing.

### 1. Push to GitHub

Ensure `quest_app` is on GitHub and up to date (`git push origin main`).

### 2. Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select `MrMode1/quest_app`.
3. Railway reads `railway.toml` in the repo:
   - **Build:** `npm run build`
   - **Pre-deploy:** `npm run db:push` (creates/updates tables)
   - **Start:** `npm start`
   - **Health check:** `GET /`

### 3. Add PostgreSQL

1. In the project canvas, click **+ New** → **Database** → **PostgreSQL**.
2. Open your **web service** → **Variables** → **Add reference** (or **Variable**).
3. Reference the Postgres service’s `DATABASE_URL` into the web service (Railway
   wires this automatically when you use “Connect” / reference from the Postgres
   tile).

### 4. Set environment variables

On the **web service** (not the database), add:

| Variable | Value |
| -------- | ----- |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SESSION_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |

`DATABASE_URL` comes from the Postgres plugin. `PORT` is set by Railway.

### 5. Deploy

Trigger a deploy (push to `main` or **Deploy** in the dashboard). When it’s
green, open **Settings** → **Networking** → **Generate Domain** for a public URL.

### 6. Verify

- Open the Railway URL → dashboard loads.
- **New Quote** → upload a sample PDF/CSV → wait for processing → export Excel.

### Notes

- **Uploads** live in `uploads/` on the container disk. They survive restarts
  but can be cleared on a **new deploy**; for production durability later, move
  files to object storage or store bytes in the DB.
- **Logs:** Railway → your service → **Deployments** → **View logs** if AI or DB
  errors appear.
- **Local schema push** against production (optional):  
  `DATABASE_URL="<railway-postgres-url>" npm run db:push`

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

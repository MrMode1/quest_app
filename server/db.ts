import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import pg from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Add it to your .env file.");
}

const connectionString = process.env.DATABASE_URL;

/** Neon HTTP driver works in Vercel serverless; pg pool for local Postgres. */
export const db = connectionString.includes("neon.tech")
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzlePg(new pg.Pool({ connectionString }), { schema });

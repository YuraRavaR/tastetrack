// The access tokens External Sources give the Worker, kept in D1 so that every invocation reuses
// one instead of asking for its own (ADR-0012).
import { eq } from "drizzle-orm";
import { type AnyD1Database, drizzle } from "drizzle-orm/d1";
import { sourceTokens } from "../../db/schema";
import type { ExternalSource } from "../../shared/api";

export interface SourceToken {
  accessToken: string;
  expiresAt: Date;
}

// The source's stored token, or null when it has none, whether or not it has expired.
export async function storedToken(
  database: AnyD1Database,
  source: ExternalSource,
): Promise<SourceToken | null> {
  const [row] = await drizzle(database)
    .select({ accessToken: sourceTokens.accessToken, expiresAt: sourceTokens.expiresAt })
    .from(sourceTokens)
    .where(eq(sourceTokens.source, source));
  return row ?? null;
}

// Keeps the source's new token in place of the one before.
export async function storeToken(
  database: AnyD1Database,
  source: ExternalSource,
  token: SourceToken,
): Promise<void> {
  await drizzle(database)
    .insert(sourceTokens)
    .values({ source, ...token })
    .onConflictDoUpdate({ target: sourceTokens.source, set: token });
}

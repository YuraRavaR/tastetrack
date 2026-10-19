// Invite Codes: existing Users issue them, and someone new registers with one.
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { inviteCodes } from "../../db/schema";
import { maxActiveInviteCodes } from "../../shared/accounts";
import type { InviteCode } from "../../shared/api";

export const inviteCodeLifetimeMs = 7 * 24 * 60 * 60 * 1000;

// Crockford's base32: digits and capitals without I, L, O and U, so a code read out or typed by
// hand has no look-alikes. 32 divides 256, so taking each random byte mod 32 is unbiased.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const groups = 3;
const groupLength = 4;

function grouped(chars: string): string {
  return chars.match(new RegExp(`.{1,${groupLength}}`, "g"))?.join("-") ?? chars;
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(groups * groupLength));
  return grouped([...bytes].map((byte) => alphabet[byte % alphabet.length]).join(""));
}

// The stored form of a code as someone typed it: any letter case, with or without the dashes,
// and with stray spaces.
export function normalizeInviteCode(typed: string): string {
  return grouped(typed.replace(/[\s-]/g, "").toUpperCase());
}

function toInviteCode(row: { code: string; expiresAt: Date }): InviteCode {
  return { code: row.code, expiresAt: row.expiresAt.toISOString() };
}

// Unused and unexpired.
export function activeAt(now: Date) {
  return and(isNull(inviteCodes.usedAt), gt(inviteCodes.expiresAt, now));
}

// Returns null when the issuer already has the most active Invite Codes allowed. The count and the
// insert are one statement, so concurrent requests can't both take the last slot.
export async function issueInviteCode(
  db: DrizzleD1Database,
  issuerId: number,
  now: Date,
): Promise<InviteCode | null> {
  const expiresAt = new Date(now.getTime() + inviteCodeLifetimeMs);
  const [issued] = await db.all<{ code: string }>(sql`
    insert into ${inviteCodes} (code, issuer_id, created_at, expires_at)
    select ${newCode()}, ${issuerId}, ${now.getTime()}, ${expiresAt.getTime()}
    where (
      select count(*) from ${inviteCodes}
      where ${and(eq(inviteCodes.issuerId, issuerId), activeAt(now))}
    ) < ${maxActiveInviteCodes}
    returning code
  `);
  return issued ? toInviteCode({ code: issued.code, expiresAt }) : null;
}

// The issuer's unused, unexpired Invite Codes, soonest to expire first.
export async function activeInviteCodes(
  db: DrizzleD1Database,
  issuerId: number,
  now: Date,
): Promise<InviteCode[]> {
  const rows = await db
    .select({ code: inviteCodes.code, expiresAt: inviteCodes.expiresAt })
    .from(inviteCodes)
    .where(and(eq(inviteCodes.issuerId, issuerId), activeAt(now)))
    .orderBy(asc(inviteCodes.expiresAt));
  return rows.map(toInviteCode);
}

export type InviteCodeProblem = "invite_code_unknown" | "invite_code_used" | "invite_code_expired";

// Why a code can't be registered with right now, or null if it can.
export async function inviteCodeProblem(
  db: DrizzleD1Database,
  code: string,
  now: Date,
): Promise<InviteCodeProblem | null> {
  const [found] = await db
    .select({ usedAt: inviteCodes.usedAt, expiresAt: inviteCodes.expiresAt })
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code));
  if (!found) return "invite_code_unknown";
  if (found.usedAt) return "invite_code_used";
  if (found.expiresAt <= now) return "invite_code_expired";
  return null;
}

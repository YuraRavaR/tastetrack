// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";
import { passwordLength, usernamePattern } from "./accounts";
import { maxSearchQueryLength } from "./catalog";
import { maxReviewLength, ratingStars } from "./log";

export const HealthResponse = z
  .object({
    status: z.literal("ok"),
    database: z.literal("ok"),
  })
  .openapi("HealthResponse");

export type HealthResponse = z.infer<typeof HealthResponse>;

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: "not_found" }),
  })
  .openapi("ErrorResponse");

export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const Username = z.string().regex(usernamePattern).openapi({ example: "olena_k" });

export const Password = z.string().min(passwordLength.min).max(passwordLength.max);

// Login checks credentials, not the rules: a malformed Username is just one that doesn't exist.
// The caps only bound the work a request can cause.
export const LoginRequest = z
  .object({
    username: z.string().min(1).max(100).openapi({ example: "olena_k" }),
    password: z.string().min(1).max(1000),
  })
  .openapi("LoginRequest");

export type LoginRequest = z.infer<typeof LoginRequest>;

export const User = z
  .object({
    username: Username,
  })
  .openapi("User");

export type User = z.infer<typeof User>;

export const UserResponse = z
  .object({
    user: User,
  })
  .openapi("UserResponse");

export type UserResponse = z.infer<typeof UserResponse>;

// Registration checks the Invite Code itself, so any string up to the cap gets that code's error.
export const RegisterRequest = z
  .object({
    inviteCode: z.string().min(1).max(100).openapi({ example: "7KQ2-M9XD-PW4T" }),
    username: Username,
    password: Password,
  })
  .openapi("RegisterRequest");

export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const InviteCode = z
  .object({
    code: z.string().openapi({ example: "7KQ2-M9XD-PW4T" }),
    expiresAt: z.iso.datetime().openapi({ example: "2026-10-26T12:00:00.000Z" }),
  })
  .openapi("InviteCode");

export type InviteCode = z.infer<typeof InviteCode>;

export const InviteCodeResponse = z
  .object({
    inviteCode: InviteCode,
  })
  .openapi("InviteCodeResponse");

export type InviteCodeResponse = z.infer<typeof InviteCodeResponse>;

export const InviteCodesResponse = z
  .object({
    inviteCodes: z.array(InviteCode),
  })
  .openapi("InviteCodesResponse");

export type InviteCodesResponse = z.infer<typeof InviteCodesResponse>;

// The catalog is searched through the External Source of each Media Type: TMDB for films.
export const MediaType = z.enum(["film"]).openapi({ example: "film" });

export type MediaType = z.infer<typeof MediaType>;

export const CatalogSearchQuery = z.object({
  mediaType: MediaType,
  query: z.string().trim().min(1).max(maxSearchQueryLength).openapi({ example: "alien" }),
});

export const ExternalReference = z
  .object({
    source: z.literal("tmdb"),
    mediaType: MediaType,
    id: z.string().openapi({ example: "348" }),
  })
  .openapi("ExternalReference");

export type ExternalReference = z.infer<typeof ExternalReference>;

// The title is the Localized Title in the query's language, or the Original Title when the
// External Source has none; titleLanguage says which language that query ran in. inLog marks a
// film the User already has a Log Entry for.
export const CatalogSearchResult = z
  .object({
    externalReference: ExternalReference,
    title: z.string().openapi({ example: "Чужий" }),
    originalTitle: z.string().openapi({ example: "Alien" }),
    year: z.int().nullable().openapi({ example: 1979 }),
    posterUrl: z.url().nullable().openapi({
      example: "https://image.tmdb.org/t/p/w92/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    }),
    titleLanguage: z.enum(["en", "uk"]).openapi({ example: "uk" }),
    inLog: z.boolean(),
  })
  .openapi("CatalogSearchResult");

export type CatalogSearchResult = z.infer<typeof CatalogSearchResult>;

export const CatalogSearchResponse = z
  .object({
    results: z.array(CatalogSearchResult),
  })
  .openapi("CatalogSearchResponse");

export type CatalogSearchResponse = z.infer<typeof CatalogSearchResponse>;

// A search result as the client got it, to add its film to the catalog. The details call
// replaces what it says; it stands in only when that call fails. inLog, if sent, is ignored.
export const AddCatalogItemRequest = CatalogSearchResult.omit({ inLog: true })
  .extend({
    externalReference: ExternalReference.extend({
      id: z
        .string()
        .regex(/^\d{1,12}$/)
        .openapi({ example: "348" }),
    }),
    title: z.string().trim().min(1).max(500).openapi({ example: "Чужий" }),
    originalTitle: z.string().trim().min(1).max(500).openapi({ example: "Alien" }),
    year: z.int().min(1800).max(3000).nullable().openapi({ example: 1979 }),
  })
  .openapi("AddCatalogItemRequest");

export type AddCatalogItemRequest = z.infer<typeof AddCatalogItemRequest>;

// A film's metadata from the External Source. The title is the English Localized Title, or the
// Original Title when there is none; ukrainianTitle is the Ukrainian one when it differs from the
// title. Runtime (minutes) and genres are unknown until the details call succeeds.
export const FilmMetadata = z
  .object({
    title: z.string().openapi({ example: "Amélie" }),
    originalTitle: z.string().openapi({ example: "Le Fabuleux Destin d'Amélie Poulain" }),
    ukrainianTitle: z.string().nullable().openapi({ example: "Амелі" }),
    year: z.int().nullable().openapi({ example: 2001 }),
    posterUrl: z.url().nullable().openapi({
      example: "https://image.tmdb.org/t/p/w92/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
    }),
    runtime: z.int().nullable().openapi({ example: 122 }),
    genres: z.array(z.string()).openapi({ example: ["Comedy", "Romance"] }),
  })
  .openapi("FilmMetadata");

export type FilmMetadata = z.infer<typeof FilmMetadata>;

// A catalog-backed Media Item. Its metadata comes from the disposable cache, so it is null while
// the cache has no entry for it.
export const MediaItem = z
  .object({
    id: z.int().openapi({ example: 42 }),
    mediaType: MediaType,
    externalReference: ExternalReference,
    metadata: FilmMetadata.nullable(),
  })
  .openapi("MediaItem");

export type MediaItem = z.infer<typeof MediaItem>;

export const MediaItemResponse = z
  .object({
    mediaItem: MediaItem,
  })
  .openapi("MediaItemResponse");

export type MediaItemResponse = z.infer<typeof MediaItemResponse>;

const LogDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: "2026-10-18", description: "A calendar day, YYYY-MM-DD" });

const Rating = z
  .number()
  .min(ratingStars.min)
  .max(ratingStars.max)
  .multipleOf(ratingStars.step)
  .openapi({ example: 4.5, description: "Stars, 0.5 to 5 in half-star steps" });

// timeZone is the User's IANA time zone, which sets the latest date allowed: today there. When it
// is missing or unknown, the latest date is tomorrow in UTC. An empty Review counts as none.
export const NewLogEntryRequest = z
  .object({
    mediaItemId: z.int().positive().openapi({ example: 42 }),
    rating: Rating,
    date: LogDate.nullable().default(null),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
    review: z.string().max(maxReviewLength).nullable().default(null),
    revisit: z.boolean().default(false),
  })
  .openapi("NewLogEntryRequest");

export type NewLogEntryRequest = z.input<typeof NewLogEntryRequest>;

export const LogEntry = z
  .object({
    id: z.int().openapi({ example: 7 }),
    mediaItem: MediaItem,
    rating: Rating,
    date: LogDate.nullable(),
    review: z.string().nullable().openapi({ example: "Still terrifying." }),
    revisit: z.boolean(),
    createdAt: z.iso.datetime().openapi({ example: "2026-10-19T19:30:00.000Z" }),
  })
  .openapi("LogEntry");

export type LogEntry = z.infer<typeof LogEntry>;

export const LogEntryResponse = z
  .object({
    logEntry: LogEntry,
  })
  .openapi("LogEntryResponse");

export type LogEntryResponse = z.infer<typeof LogEntryResponse>;

export const LogResponse = z
  .object({
    logEntries: z.array(LogEntry),
  })
  .openapi("LogResponse");

export type LogResponse = z.infer<typeof LogResponse>;

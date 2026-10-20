// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";
import { passwordLength, usernamePattern } from "./accounts";
import { maxSearchQueryLength } from "./catalog";
import { maxNoteLength } from "./lists";
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
// film the User already has a Log Entry for, and inBacklog one in the User's Backlog.
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
    inBacklog: z.boolean(),
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
// replaces what it says; it stands in only when that call fails. inLog and inBacklog, if sent,
// are ignored.
export const AddCatalogItemRequest = CatalogSearchResult.omit({ inLog: true, inBacklog: true })
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

// Only the fields given change; a null date or Review clears it. The Media Item can't change, and
// the creation time never does, so an edited entry keeps its place among same-day entries.
export const LogEntryEditRequest = z
  .object({
    rating: Rating.optional(),
    date: LogDate.nullable().optional(),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
    review: z.string().max(maxReviewLength).nullable().optional(),
    revisit: z.boolean().optional(),
  })
  .strict()
  .openapi("LogEntryEditRequest");

export type LogEntryEditRequest = z.infer<typeof LogEntryEditRequest>;

export const LogEntryParams = z.object({
  logEntryId: z.coerce.number().int().positive().openapi({ example: 7 }),
});

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

// Where a List Item was in its List, counted from 0, and its Note, once it is gone.
export const RemovedListItem = z
  .object({
    position: z.int().min(0).openapi({ example: 2 }),
    note: z.string().nullable().openapi({ example: "Olena's favourite." }),
  })
  .openapi("RemovedListItem");

export type RemovedListItem = z.infer<typeof RemovedListItem>;

// A new Log Entry, and where its Media Item was in the User's Backlog before logging it took it
// off, or null when it wasn't there.
export const NewLogEntryResponse = LogEntryResponse.extend({
  removedFromBacklog: RemovedListItem.nullable(),
}).openapi("NewLogEntryResponse");

export type NewLogEntryResponse = z.infer<typeof NewLogEntryResponse>;

export const LogResponse = z
  .object({
    logEntries: z.array(LogEntry),
  })
  .openapi("LogResponse");

export type LogResponse = z.infer<typeof LogResponse>;

export const MediaItemParams = z.object({
  mediaItemId: z.coerce.number().int().positive().openapi({ example: 42 }),
});

// One User's Item History of a Media Item: every Log Entry for it in Log Order, and the Current
// Rating, which is the last one's Rating. A film the User hasn't experienced has neither.
export const ItemHistoryResponse = z
  .object({
    mediaItem: MediaItem,
    logEntries: z.array(LogEntry),
    currentRating: Rating.nullable(),
  })
  .openapi("ItemHistoryResponse");

export type ItemHistoryResponse = z.infer<typeof ItemHistoryResponse>;

// The optional free text of a List Item.
const Note = z.string().max(maxNoteLength).openapi({ example: "Olena's favourite." });

// Marks a Media Item Planned, adding it to the User's Backlog of its Media Type at `position`,
// counted from 0, or at the end without one. An empty Note counts as none.
export const PlanRequest = z
  .object({
    mediaItemId: z.int().positive().openapi({ example: 42 }),
    position: z.int().min(0).optional().openapi({ example: 0 }),
    note: Note.nullable().optional(),
  })
  .openapi("PlanRequest");

export type PlanRequest = z.infer<typeof PlanRequest>;

export const BacklogQuery = z.object({
  mediaType: MediaType,
});

// One Media Item's place in a List, counted from 0, and its optional Note.
export const ListItem = z
  .object({
    id: z.int().openapi({ example: 12 }),
    mediaItem: MediaItem,
    position: z.int().min(0).openapi({ example: 0 }),
    note: Note.nullable(),
  })
  .openapi("ListItem");

export type ListItem = z.infer<typeof ListItem>;

// A User's Backlog of one Media Type, in order. It has no name: the UI calls a film Backlog the
// Watchlist.
export const Backlog = z
  .object({
    id: z.int().openapi({ example: 3 }),
    mediaType: MediaType,
    items: z.array(ListItem),
  })
  .openapi("Backlog");

export type Backlog = z.infer<typeof Backlog>;

export const BacklogResponse = z
  .object({
    backlog: Backlog,
  })
  .openapi("BacklogResponse");

export type BacklogResponse = z.infer<typeof BacklogResponse>;

export const ListItemResponse = z
  .object({
    listItem: ListItem,
  })
  .openapi("ListItemResponse");

export type ListItemResponse = z.infer<typeof ListItemResponse>;

// Only the fields given change: `position` moves the List Item there, counted from 0, with past
// the end meaning last; a null or empty Note clears it.
export const ListItemEditRequest = z
  .object({
    position: z.int().min(0).optional().openapi({ example: 0 }),
    note: Note.nullable().optional(),
  })
  .strict()
  .openapi("ListItemEditRequest");

export type ListItemEditRequest = z.infer<typeof ListItemEditRequest>;

export const ListItemParams = z.object({
  listItemId: z.coerce.number().int().positive().openapi({ example: 12 }),
});

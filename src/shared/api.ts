// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";
import { maxDisplayNameLength, passwordLength, usernamePattern } from "./accounts";
import {
  earliestFilmYear,
  filmGenres,
  filmRuntime,
  maxManualTitleLength,
  maxMetadataFills,
  maxSearchQueryLength,
} from "./catalog";
import { maxListDescriptionLength, maxListNameLength, maxNoteLength, visibilities } from "./lists";
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

// The Display Name is what others see of the User, on Share Links; it is the Username until the
// User sets one.
export const User = z
  .object({
    username: Username,
    displayName: z.string().openapi({ example: "Olena K." }),
  })
  .openapi("User");

export type User = z.infer<typeof User>;

export const UserResponse = z
  .object({
    user: User,
  })
  .openapi("UserResponse");

export type UserResponse = z.infer<typeof UserResponse>;

// passwordChangeRequired says the password was a Temporary Password the Operator issued: the session
// can only set the User's own new password until they do.
export const LoginResponse = z
  .object({
    user: User,
    passwordChangeRequired: z.boolean(),
  })
  .openapi("LoginResponse");

export type LoginResponse = z.infer<typeof LoginResponse>;

// The Display Name is trimmed, and a null or empty one puts the Username back in its place.
export const DisplayNameRequest = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(maxDisplayNameLength)
      .nullable()
      .openapi({ example: "Olena K." }),
  })
  .openapi("DisplayNameRequest");

export type DisplayNameRequest = z.infer<typeof DisplayNameRequest>;

// The current password is checked, not held to the rules, like a login's; its cap only bounds
// the work a request can cause. The new one follows the rules.
export const PasswordChangeRequest = z
  .object({
    currentPassword: z.string().min(1).max(1000),
    newPassword: Password,
  })
  .openapi("PasswordChangeRequest");

export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequest>;

// The password confirms the deletion; like a login's, it is checked, not held to the rules.
export const UserDeletionRequest = z
  .object({
    password: z.string().min(1).max(1000),
  })
  .openapi("UserDeletionRequest");

export type UserDeletionRequest = z.infer<typeof UserDeletionRequest>;

// The User's own password, in place of the Temporary Password the Operator issued: it follows the
// rules, and mustn't be the Temporary Password.
export const NewPasswordRequest = z
  .object({
    newPassword: Password,
  })
  .openapi("NewPasswordRequest");

export type NewPasswordRequest = z.infer<typeof NewPasswordRequest>;

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

// A Media Item. A catalog-backed one's metadata comes from the disposable cache, so it is null
// while the cache has no entry for it. A Manual Media Item has no External Reference, and its
// metadata is what its User gave: never a poster or a Ukrainian title, and the title as its
// Original Title when it has none.
export const MediaItem = z
  .object({
    id: z.int().openapi({ example: 42 }),
    mediaType: MediaType,
    externalReference: ExternalReference.nullable(),
    metadata: FilmMetadata.nullable(),
  })
  .openapi("MediaItem");

export type MediaItem = z.infer<typeof MediaItem>;

// One of the User's own Manual Media Items that matches a search, marked like a search result.
export const ManualSearchResult = z
  .object({
    mediaItem: MediaItem,
    inLog: z.boolean(),
    inBacklog: z.boolean(),
  })
  .openapi("ManualSearchResult");

export type ManualSearchResult = z.infer<typeof ManualSearchResult>;

// The User's own matching Manual Media Items, to be listed first, and the External Source's
// results.
export const CatalogSearchResponse = z
  .object({
    manualResults: z.array(ManualSearchResult),
    results: z.array(CatalogSearchResult),
  })
  .openapi("CatalogSearchResponse");

export type CatalogSearchResponse = z.infer<typeof CatalogSearchResponse>;

// Media Items by id, for loading what a page showed as placeholders: 1 to `maxMetadataFills`
// positive ids, comma-separated.
export const MediaItemIdsQuery = z.object({
  ids: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform((ids) => ids.split(",").map(Number))
    .pipe(z.array(z.int().positive()).min(1).max(maxMetadataFills))
    .openapi({ type: "string", example: "42,43" }),
});

export const MediaItemsResponse = z
  .object({
    mediaItems: z.array(MediaItem),
  })
  .openapi("MediaItemsResponse");

export type MediaItemsResponse = z.infer<typeof MediaItemsResponse>;

export const MediaItemResponse = z
  .object({
    mediaItem: MediaItem,
  })
  .openapi("MediaItemResponse");

export type MediaItemResponse = z.infer<typeof MediaItemResponse>;

// What a User gives about a Manual Media Item. Titles are trimmed, and an empty Original Title
// counts as none. A year after five years from now is refused too, by the Worker, which knows
// when now is. Genres are TMDB's film genres, each at most once.
const ManualTitle = z
  .string()
  .trim()
  .min(1)
  .max(maxManualTitleLength)
  .openapi({ example: "Тіні забутих предків" });

const ManualOriginalTitle = z
  .string()
  .trim()
  .max(maxManualTitleLength)
  .nullable()
  .openapi({ example: "Shadows of Forgotten Ancestors" });

const ManualYear = z.int().min(earliestFilmYear).nullable().openapi({ example: 1965 });

const ManualRuntime = z
  .int()
  .min(filmRuntime.min)
  .max(filmRuntime.max)
  .nullable()
  .openapi({ example: 97, description: "Minutes" });

const ManualGenres = z
  .array(z.enum(filmGenres))
  .refine((genres) => new Set(genres).size === genres.length, "Each genre at most once")
  .openapi({ example: ["Drama", "Romance"] });

// A new Manual Media Item. One with the same title and year as another of the User's is refused
// as a possible duplicate unless allowDuplicate says to make it anyway.
export const NewManualMediaItemRequest = z
  .object({
    mediaType: MediaType,
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualYear.default(null),
    runtime: ManualRuntime.default(null),
    genres: ManualGenres.default([]),
    allowDuplicate: z.boolean().default(false),
  })
  .openapi("NewManualMediaItemRequest");

export type NewManualMediaItemRequest = z.input<typeof NewManualMediaItemRequest>;

export type NewManualMediaItem = z.output<typeof NewManualMediaItemRequest>;

// Only the fields given change, by the same rules as a new one; a null or empty Original Title,
// or a null year or runtime, clears it. The Media Type can't change.
export const ManualMediaItemEditRequest = z
  .object({
    title: ManualTitle.optional(),
    originalTitle: ManualOriginalTitle.optional(),
    year: ManualYear.optional(),
    runtime: ManualRuntime.optional(),
    genres: ManualGenres.optional(),
  })
  .strict()
  .openapi("ManualMediaItemEditRequest");

export type ManualMediaItemEditRequest = z.infer<typeof ManualMediaItemEditRequest>;

// A Manual Media Item, and what deleting it would delete with it: the User's Log Entries for it
// and the List Items, the Backlog's included, it has.
export const ManualMediaItemResponse = z
  .object({
    mediaItem: MediaItem,
    usage: z.object({
      logEntries: z.int().min(0).openapi({ example: 2 }),
      listItems: z.int().min(0).openapi({ example: 1 }),
    }),
  })
  .openapi("ManualMediaItemResponse");

export type ManualMediaItemResponse = z.infer<typeof ManualMediaItemResponse>;

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

export const Visibility = z.enum(visibilities).openapi({ example: "private" });

// A List's Share Link, which shows it to anyone holding the URL, without login. The token is
// random, so the URL says nothing about the List.
export const ShareLink = z
  .object({
    token: z.string().openapi({ example: "q3Vb8kXo2LmN5pRt7wYz1A" }),
    url: z.url().openapi({ example: "https://tastetrack.example/s/q3Vb8kXo2LmN5pRt7wYz1A" }),
  })
  .openapi("ShareLink");

export type ShareLink = z.infer<typeof ShareLink>;

export const ShareLinkResponse = z
  .object({
    shareLink: ShareLink,
  })
  .openapi("ShareLinkResponse");

export type ShareLinkResponse = z.infer<typeof ShareLinkResponse>;

// A User's Backlog of one Media Type, in order, and its Share Link while it has one. It has no
// name: the UI calls a film Backlog the Watchlist.
export const Backlog = z
  .object({
    id: z.int().openapi({ example: 3 }),
    mediaType: MediaType,
    visibility: Visibility,
    shareLink: ShareLink.nullable(),
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

// A List's name is trimmed; two names that differ only in case are the same name. An empty
// description counts as none.
const ListName = z
  .string()
  .trim()
  .min(1)
  .max(maxListNameLength)
  .openapi({ example: "Horror nights" });

const ListDescription = z
  .string()
  .max(maxListDescriptionLength)
  .openapi({ example: "Something to watch each Friday in October." });

// The Media Type is set once, here.
export const NewListRequest = z
  .object({
    name: ListName,
    description: ListDescription.nullable().optional(),
    mediaType: MediaType,
  })
  .openapi("NewListRequest");

export type NewListRequest = z.input<typeof NewListRequest>;

// Only the fields given change; a null or empty description clears it. The Media Type is set
// once, when the List is made, and Visibility changes only through its Share Link.
export const ListEditRequest = z
  .object({
    name: ListName.optional(),
    description: ListDescription.nullable().optional(),
  })
  .strict()
  .openapi("ListEditRequest");

export type ListEditRequest = z.infer<typeof ListEditRequest>;

// One of the User's own Lists without its items, and how many it holds.
export const ListSummary = z
  .object({
    id: z.int().openapi({ example: 5 }),
    name: z.string().openapi({ example: "Horror nights" }),
    description: z.string().nullable().openapi({ example: "Something to watch each Friday." }),
    mediaType: MediaType,
    visibility: Visibility,
    itemCount: z.int().min(0).openapi({ example: 3 }),
  })
  .openapi("ListSummary");

export type ListSummary = z.infer<typeof ListSummary>;

export const ListSummaryResponse = z
  .object({
    list: ListSummary,
  })
  .openapi("ListSummaryResponse");

export type ListSummaryResponse = z.infer<typeof ListSummaryResponse>;

export const ListsResponse = z
  .object({
    lists: z.array(ListSummary),
  })
  .openapi("ListsResponse");

export type ListsResponse = z.infer<typeof ListsResponse>;

// Where a Media Item sits in one List: its List Item, its place counted from 0, and its Note.
export const ListItemPlace = z
  .object({
    id: z.int().openapi({ example: 17 }),
    position: z.int().min(0).openapi({ example: 2 }),
    note: z.string().nullable().openapi({ example: "Olena's favourite." }),
  })
  .openapi("ListItemPlace");

export type ListItemPlace = z.infer<typeof ListItemPlace>;

// One of the User's Lists, with the List Item that holds a given Media Item, or null.
export const MediaItemList = ListSummary.extend({
  listItem: ListItemPlace.nullable(),
}).openapi("MediaItemList");

export type MediaItemList = z.infer<typeof MediaItemList>;

export const MediaItemListsResponse = z
  .object({
    lists: z.array(MediaItemList),
  })
  .openapi("MediaItemListsResponse");

export type MediaItemListsResponse = z.infer<typeof MediaItemListsResponse>;

// One of the User's own Lists with its Share Link while it has one, and its List Items in order.
export const List = ListSummary.omit({ itemCount: true })
  .extend({ shareLink: ShareLink.nullable(), items: z.array(ListItem) })
  .openapi("List");

export type List = z.infer<typeof List>;

export const ListResponse = z
  .object({
    list: List,
  })
  .openapi("ListResponse");

export type ListResponse = z.infer<typeof ListResponse>;

export const ListParams = z.object({
  listId: z.coerce.number().int().positive().openapi({ example: 5 }),
});

// Adds a Media Item to one of the User's Lists at `position`, counted from 0, or at the end
// without one: putting a removed item back where it was, with its Note, undoes the removal. An
// empty Note counts as none.
export const NewListItemRequest = z
  .object({
    mediaItemId: z.int().positive().openapi({ example: 42 }),
    position: z.int().min(0).optional().openapi({ example: 0 }),
    note: Note.nullable().optional(),
  })
  .openapi("NewListItemRequest");

export type NewListItemRequest = z.infer<typeof NewListItemRequest>;

// Any token is looked up as it is, so a malformed one is just one that doesn't exist.
export const ShareTokenParams = z.object({
  token: z.string().openapi({ example: "q3Vb8kXo2LmN5pRt7wYz1A" }),
});

// A Media Item's place in a shared List, counted from 0, and its Note.
export const SharedListItem = z
  .object({
    mediaItem: MediaItem,
    position: z.int().min(0).openapi({ example: 0 }),
    note: Note.nullable(),
  })
  .openapi("SharedListItem");

export type SharedListItem = z.infer<typeof SharedListItem>;

// A List as its Share Link shows it to anyone: its title, which for a Backlog is "<Display
// Name>'s Watchlist", its description, its owner's Display Name and its List Items with their
// Notes. Never the owner's Ratings or Log Entries.
export const SharedList = z
  .object({
    title: z.string().openapi({ example: "Horror nights" }),
    description: z.string().nullable().openapi({ example: "Something to watch each Friday." }),
    mediaType: MediaType,
    owner: z.object({ displayName: z.string().openapi({ example: "olena_k" }) }),
    items: z.array(SharedListItem),
  })
  .openapi("SharedList");

export type SharedList = z.infer<typeof SharedList>;

export const SharedListResponse = z
  .object({
    sharedList: SharedList,
  })
  .openapi("SharedListResponse");

export type SharedListResponse = z.infer<typeof SharedListResponse>;

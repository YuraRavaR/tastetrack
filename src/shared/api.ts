// Schemas for the HTTP API, shared by the Worker (validation and the OpenAPI
// spec) and the client (response types).
import { z } from "@hono/zod-openapi";
import { maxDisplayNameLength, passwordLength, usernamePattern } from "./accounts";
import {
  earliestBookYear,
  earliestFilmYear,
  filmGenres,
  filmRuntime,
  lightMediaTypes,
  maxManualAuthors,
  maxManualTitleLength,
  maxMetadataFills,
  maxSearchQueryLength,
} from "./catalog";
import {
  listCoverCount,
  maxListDescriptionLength,
  maxListNameLength,
  maxNoteLength,
  visibilities,
} from "./lists";
import { maxReviewLength, ratingStars } from "./log";
import { mbidPattern } from "./musicbrainz";
import { songSearchLimit } from "./musicbrainz-songs";
import { maxPage } from "./progress";
import { maxThoughtLength, thoughtStates } from "./thoughts";

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

// The catalog is searched through the External Source of each Media Type: TMDB for films and
// series, Open Library for books, IGDB for games, MusicBrainz for albums, songs and artists. A song
// and an artist are light Media Types, kept only in Lists (ADR-0005).
export const MediaType = z
  .enum(["film", "book", "series", "game", "album", "song", "artist"])
  .openapi({ example: "film" });

export type MediaType = z.infer<typeof MediaType>;

// A List's name the User's other List has, and that List's Media Type, which may differ from the
// new one's: a name is unique across all of the User's Lists.
export const ListNameTakenResponse = z
  .object({
    error: z.literal("list_name_taken"),
    mediaType: MediaType,
  })
  .openapi("ListNameTakenResponse");

export type ListNameTakenResponse = z.infer<typeof ListNameTakenResponse>;

export const ExternalSource = z
  .enum(["tmdb", "openlibrary", "igdb", "musicbrainz"])
  .openapi({ example: "tmdb" });

export type ExternalSource = z.infer<typeof ExternalSource>;

export const CatalogSearchQuery = z.object({
  mediaType: MediaType,
  query: z.string().trim().min(1).max(maxSearchQueryLength).openapi({ example: "alien" }),
});

export const ExternalReference = z
  .object({
    source: ExternalSource,
    mediaType: MediaType,
    id: z.string().openapi({ example: "348" }),
  })
  .openapi("ExternalReference");

export type ExternalReference = z.infer<typeof ExternalReference>;

const Rating = z
  .number()
  .min(ratingStars.min)
  .max(ratingStars.max)
  .multipleOf(ratingStars.step)
  .openapi({ example: 4.5, description: "Stars, 0.5 to 5 in half-star steps" });

// One of the User's own Lists holding a search result.
export const HoldingList = z
  .object({
    id: z.int().openapi({ example: 5 }),
    name: z.string().openapi({ example: "Horror nights" }),
  })
  .openapi("HoldingList");

export type HoldingList = z.infer<typeof HoldingList>;

// What a search result shows of the User's own: inLog marks a film they have a Log Entry for, with
// its Current Rating and how many they have, inBacklog one in their Backlog, and lists their Lists
// holding it, oldest first. A film not in the catalog has none of these.
const UserMarks = {
  inLog: z.boolean(),
  inBacklog: z.boolean(),
  currentRating: Rating.nullable(),
  logEntryCount: z.int().min(0).openapi({ example: 2 }),
  lists: z.array(HoldingList),
};

// mediaItemId is the work's Media Item, null until it joins the catalog.
const SearchMarkFields = {
  mediaItemId: z.int().positive().nullable().openapi({ example: 42 }),
  ...UserMarks,
};

// The title is the Localized Title in the query's language, or the Original Title when the
// External Source has none; titleLanguage says which language that query ran in. posterUrl is the
// cover's thumbnail, whatever the Media Type calls its cover. authors are a book's, as names in
// the source's order; a film has none. platforms are a game's, each by its abbreviation, in the
// source's order; a result of any other Media Type leaves them out. artistCredit is an album's or
// a song's, primaryType and secondaryTypes an album's, as AlbumMetadata has them, album a song's,
// as SongMetadata has it, disambiguation a song's or an artist's, and artistType, country and
// endYear an artist's, as ArtistMetadata has them, whose year is their begin year; a result of any
// other Media Type leaves them out. An artist's row has no photo.
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
    authors: z.array(z.string()).openapi({ example: [] }),
    platforms: z
      .array(z.string())
      .optional()
      .openapi({ example: ["PC", "PS4", "PS5"], description: "A game's alone" }),
    artistCredit: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "Океан Ельзи", description: "An album's or a song's alone" }),
    primaryType: z
      .enum(["Album", "EP"])
      .optional()
      .openapi({ example: "Album", description: "An album's alone" }),
    secondaryTypes: z
      .array(z.string())
      .optional()
      .openapi({ example: [], description: "An album's alone" }),
    album: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "Земля", description: "A song's alone" }),
    disambiguation: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: null, description: "A song's or an artist's alone" }),
    artistType: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "Group", description: "An artist's alone" }),
    country: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "UA", description: "An artist's alone" }),
    endYear: z
      .int()
      .nullable()
      .optional()
      .openapi({ example: null, description: "An artist's alone" }),
    ...SearchMarkFields,
  })
  .openapi("CatalogSearchResult");

export type CatalogSearchResult = z.infer<typeof CatalogSearchResult>;

// A search result before what the app holds about it, its Media Item and the User's marks, is
// added to it: what an External Source's answer alone gives.
export type CatalogSearchMatch = Omit<CatalogSearchResult, keyof typeof SearchMarkFields>;

// What a search row carries of the app's own about one External Reference: its Media Item and the
// User's marks.
export const SearchMarks = z.object(SearchMarkFields).openapi("SearchMarks");

export type SearchMarks = z.infer<typeof SearchMarks>;

// A search result as the client got it, to add its work to the catalog. The details call
// replaces what it says; it stands in only when that call fails. Its External Reference names a
// Media Type's own External Source, with an id as that source writes them. authors, platforms,
// an album's or a song's credit, an album's types, a song's album, a song's or an artist's
// disambiguation, an artist's type, country and end year, mediaItemId and the User's marks, if
// sent, are ignored.
export const AddCatalogItemRequest = CatalogSearchResult.omit({
  authors: true,
  platforms: true,
  artistCredit: true,
  primaryType: true,
  secondaryTypes: true,
  album: true,
  disambiguation: true,
  artistType: true,
  country: true,
  endYear: true,
  mediaItemId: true,
  inLog: true,
  inBacklog: true,
  currentRating: true,
  logEntryCount: true,
  lists: true,
})
  .extend({
    externalReference: z.discriminatedUnion("mediaType", [
      z.object({
        source: z.literal("tmdb"),
        mediaType: z.literal("film"),
        id: z
          .string()
          .regex(/^\d{1,12}$/)
          .openapi({ example: "348" }),
      }),
      z.object({
        source: z.literal("openlibrary"),
        mediaType: z.literal("book"),
        id: z
          .string()
          .regex(/^OL\d{1,12}W$/)
          .openapi({ example: "OL2094429W" }),
      }),
      z.object({
        source: z.literal("tmdb"),
        mediaType: z.literal("series"),
        id: z
          .string()
          .regex(/^\d{1,12}$/)
          .openapi({ example: "87108" }),
      }),
      z.object({
        source: z.literal("igdb"),
        mediaType: z.literal("game"),
        id: z
          .string()
          .regex(/^\d{1,12}$/)
          .openapi({ example: "1942" }),
      }),
      z.object({
        source: z.literal("musicbrainz"),
        mediaType: z.literal("album"),
        id: z
          .string()
          .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
          .openapi({ example: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8" }),
      }),
      z.object({
        source: z.literal("musicbrainz"),
        mediaType: z.literal("song"),
        id: z
          .string()
          .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
          .openapi({ example: "d8d55f18-0c4b-4036-a16d-e273ac8953fc" }),
      }),
      z.object({
        source: z.literal("musicbrainz"),
        mediaType: z.literal("artist"),
        id: z
          .string()
          .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
          .openapi({ example: "87a417d3-f118-43e0-bece-3de1bd90fce0" }),
      }),
    ]),
    title: z.string().trim().min(1).max(500).openapi({ example: "Чужий" }),
    originalTitle: z.string().trim().min(1).max(500).openapi({ example: "Alien" }),
    // A book may be centuries older than any film, so the year is only kept within reason.
    year: z.int().min(-3000).max(3000).nullable().openapi({ example: 1979 }),
  })
  .openapi("AddCatalogItemRequest");

export type AddCatalogItemRequest = z.infer<typeof AddCatalogItemRequest>;

// A film's metadata from the External Source. The title is the English Localized Title, or the
// Original Title when there is none; ukrainianTitle is the Ukrainian one when it differs from the
// title. The poster comes in a size for a thumbnail and one for a poster grid or a film's banner.
// Runtime (minutes) and genres are unknown until the details call succeeds, and so is the
// backdrop, which comes in a size for a phone's screen and one for a larger screen's.
export const FilmMetadata = z
  .object({
    title: z.string().openapi({ example: "Amélie" }),
    originalTitle: z.string().openapi({ example: "Le Fabuleux Destin d'Amélie Poulain" }),
    ukrainianTitle: z.string().nullable().openapi({ example: "Амелі" }),
    year: z.int().nullable().openapi({ example: 2001 }),
    posterUrls: z
      .object({
        small: z.url().openapi({
          example: "https://image.tmdb.org/t/p/w92/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
        }),
        large: z.url().openapi({
          example: "https://image.tmdb.org/t/p/w500/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
        }),
      })
      .nullable(),
    backdropUrls: z
      .object({
        small: z.url().openapi({
          example: "https://image.tmdb.org/t/p/w780/6n53UI4mX9QMfe2S0Pgt8mGebY1.jpg",
        }),
        large: z.url().openapi({
          example: "https://image.tmdb.org/t/p/w1280/6n53UI4mX9QMfe2S0Pgt8mGebY1.jpg",
        }),
      })
      .nullable(),
    runtime: z.int().nullable().openapi({ example: 122 }),
    genres: z.array(z.string()).openapi({ example: ["Comedy", "Romance"] }),
  })
  .openapi("FilmMetadata");

export type FilmMetadata = z.infer<typeof FilmMetadata>;

// A cover in a size for a thumbnail and one for a grid or an item's page, whatever its Media Type.
export type CoverUrls = NonNullable<FilmMetadata["posterUrls"]>;

// A book's metadata from the External Source, where a book is a work (ADR-0011). The titles follow
// a film's rules: the title is an English edition's, or the work's own, its Original Title, when
// it has none; ukrainianTitle is a Ukrainian edition's when it differs from the title. The year is
// when the work was first published. The cover comes in a size for a thumbnail and one for a grid
// or the book's page. Authors are names for display, in the source's order, translators among
// them where the source lists them so; none until the details call succeeds.
export const BookMetadata = z
  .object({
    title: z.string().openapi({ example: "Harry Potter and the Philosopher's Stone" }),
    originalTitle: z.string().openapi({ example: "Harry Potter and the Philosopher's Stone" }),
    ukrainianTitle: z
      .string()
      .nullable()
      .openapi({ example: "Гаррі Поттер і філософський камінь" }),
    year: z.int().nullable().openapi({ example: 1997 }),
    coverUrls: z
      .object({
        small: z.url().openapi({ example: "https://covers.openlibrary.org/b/id/15155833-M.jpg" }),
        large: z.url().openapi({ example: "https://covers.openlibrary.org/b/id/15155833-L.jpg" }),
      })
      .nullable(),
    authors: z.array(z.string()).openapi({ example: ["J. K. Rowling"] }),
  })
  .openapi("BookMetadata");

export type BookMetadata = z.infer<typeof BookMetadata>;

// How far a series has got on TMDB: still running, ended for good, or not yet aired.
export const SeriesStatus = z
  .enum(["returning", "in_production", "planned", "pilot", "ended", "canceled"])
  .openapi({ example: "ended" });

export type SeriesStatus = z.infer<typeof SeriesStatus>;

// One episode of a series, by its season and its number in that season.
export const SeriesEpisode = z
  .object({
    season: z.int().min(1).openapi({ example: 5 }),
    episode: z.int().min(1).openapi({ example: 16 }),
  })
  .openapi("SeriesEpisode");

export type SeriesEpisode = z.infer<typeof SeriesEpisode>;

// A series' metadata from the External Source, where a series is the whole show (ADR-0004). The
// titles, poster and backdrop follow a film's rules, and the year is the year it first aired.
// firstAirYear and lastAirYear are the years it first and last aired; status says whether more is
// coming. seasons are its regular seasons in order, each with its number and episode count, and
// never season 0, the specials. lastAiredEpisode is the last regular episode that has aired, and
// nextAirDate the day the next one airs, when TMDB knows it. A season lists episodes before they
// air, so whether a User is caught up is measured against lastAiredEpisode. All but the titles,
// the year and the poster are unknown until the details call succeeds.
export const SeriesMetadata = FilmMetadata.pick({ posterUrls: true, backdropUrls: true })
  .extend({
    title: z.string().openapi({ example: "Chernobyl" }),
    originalTitle: z.string().openapi({ example: "Chernobyl" }),
    ukrainianTitle: z.string().nullable().openapi({ example: "Чорнобиль" }),
    year: z.int().nullable().openapi({ example: 2019 }),
    firstAirYear: z.int().nullable().openapi({ example: 2019 }),
    lastAirYear: z.int().nullable().openapi({ example: 2019 }),
    status: SeriesStatus.nullable(),
    seasons: z
      .array(
        z.object({
          season: z.int().min(1).openapi({ example: 1 }),
          episodeCount: z.int().min(0).openapi({ example: 5 }),
        }),
      )
      .openapi({ example: [{ season: 1, episodeCount: 5 }] }),
    lastAiredEpisode: SeriesEpisode.nullable(),
    nextAirDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .openapi({ example: null, description: "A calendar day, YYYY-MM-DD" }),
  })
  .openapi("SeriesMetadata");

export type SeriesMetadata = z.infer<typeof SeriesMetadata>;

// A game's metadata from the External Source, where a game is the work across all its platforms,
// never an edition, a port or a DLC (ADR-0012). It has one title, IGDB's name, which is its
// Original Title too, and never a Ukrainian one. The year is the year it first came out on any
// platform. The cover comes in a size for a thumbnail and one for a grid or the game's page, and
// the backdrop, the game's own art, in a size for a phone's banner and one for a larger screen's.
// developer is the first company IGDB credits as one; platforms are each platform's abbreviation,
// in IGDB's order; url is the game's page on IGDB. All but the title, the year and the cover are
// unknown until the details call succeeds. Its summary is for its page alone (GameAbout).
export const GameMetadata = z
  .object({
    title: z.string().openapi({ example: "The Witcher 3: Wild Hunt" }),
    originalTitle: z.string().openapi({ example: "The Witcher 3: Wild Hunt" }),
    ukrainianTitle: z.null(),
    year: z.int().nullable().openapi({ example: 2015 }),
    coverUrls: z
      .object({
        small: z.url().openapi({
          example: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
        }),
        large: z.url().openapi({
          example: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaarl.jpg",
        }),
      })
      .nullable(),
    backdropUrls: z
      .object({
        small: z.url().openapi({
          example: "https://images.igdb.com/igdb/image/upload/t_720p/ar6ijr.jpg",
        }),
        large: z.url().openapi({
          example: "https://images.igdb.com/igdb/image/upload/t_1080p/ar6ijr.jpg",
        }),
      })
      .nullable(),
    developer: z.string().nullable().openapi({ example: "CD Projekt RED" }),
    platforms: z.array(z.string()).openapi({ example: ["PC", "PS4", "PS5"] }),
    genres: z.array(z.string()).openapi({ example: ["Role-playing (RPG)", "Adventure"] }),
    url: z
      .url()
      .nullable()
      .openapi({ example: "https://www.igdb.com/games/the-witcher-3-wild-hunt" }),
  })
  .openapi("GameMetadata");

export type GameMetadata = z.infer<typeof GameMetadata>;

// An album's metadata from the External Source, where an album is a MusicBrainz release group, the
// work across all its editions, never one release (ADR-0013). It has one title, MusicBrainz's,
// which is its Original Title too, and never a Ukrainian one. The year is the year of its first
// release. The cover is square, from the Cover Art Archive, in a size for a thumbnail and one for a
// grid or the album's page; it is linked whether or not the archive has one, and an image that
// doesn't load shows the album placeholder. artistCredit is the credit as MusicBrainz shows it,
// each credited name followed by its join phrase, and artists the credited names alone, in its
// order; a Manual Media Item's artists are its User's, joined by commas into its credit.
// primaryType is Album or EP, and secondaryTypes say what else it is, such as Live or Soundtrack;
// url is its release group on MusicBrainz. All but the title, the year and the cover are unknown
// until the details call succeeds.
export const AlbumMetadata = z
  .object({
    title: z.string().openapi({ example: "Земля" }),
    originalTitle: z.string().openapi({ example: "Земля" }),
    ukrainianTitle: z.null(),
    year: z.int().nullable().openapi({ example: 2013 }),
    coverUrls: z
      .object({
        small: z.url().openapi({
          example:
            "https://coverartarchive.org/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8/front-250",
        }),
        large: z.url().openapi({
          example:
            "https://coverartarchive.org/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8/front-500",
        }),
      })
      .nullable(),
    artistCredit: z.string().nullable().openapi({ example: "Океан Ельзи" }),
    artists: z.array(z.string()).openapi({ example: ["Океан Ельзи"] }),
    primaryType: z.enum(["Album", "EP"]).nullable().openapi({ example: "Album" }),
    secondaryTypes: z.array(z.string()).openapi({ example: [] }),
    url: z.url().nullable().openapi({
      example: "https://musicbrainz.org/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
    }),
  })
  .openapi("AlbumMetadata");

export type AlbumMetadata = z.infer<typeof AlbumMetadata>;

// A song's metadata from the External Source, where a song is a MusicBrainz recording, one across
// every release it is on (ADR-0013). It has one title, MusicBrainz's, which is its Original Title
// too, and never a Ukrainian one. The year is the year of its first release. The cover is square,
// the Cover Art Archive's front cover of the release group its first studio release is on, in a
// size for a thumbnail and one for the song's page; an image that doesn't load shows the song
// placeholder. artistCredit and artists are as an album's. album is the title of the studio Album
// it is from, if it is on one; disambiguation is MusicBrainz's short note that tells two versions
// apart ("original version"); url is its recording on MusicBrainz. All but the title, the year and
// the cover are unknown until the details call succeeds.
export const SongMetadata = z
  .object({
    title: z.string().openapi({ example: "Обійми" }),
    originalTitle: z.string().openapi({ example: "Обійми" }),
    ukrainianTitle: z.null(),
    year: z.int().nullable().openapi({ example: 2013 }),
    coverUrls: z
      .object({
        small: z.url().openapi({
          example:
            "https://coverartarchive.org/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8/front-250",
        }),
        large: z.url().openapi({
          example:
            "https://coverartarchive.org/release-group/080f0c63-6e0b-42d0-917d-e22d1d4bdaf8/front-500",
        }),
      })
      .nullable(),
    artistCredit: z.string().nullable().openapi({ example: "Океан Ельзи" }),
    artists: z.array(z.string()).openapi({ example: ["Океан Ельзи"] }),
    album: z.string().nullable().openapi({ example: "Земля" }),
    disambiguation: z.string().nullable().openapi({ example: null }),
    url: z.url().nullable().openapi({
      example: "https://musicbrainz.org/recording/d8d55f18-0c4b-4036-a16d-e273ac8953fc",
    }),
  })
  .openapi("SongMetadata");

export type SongMetadata = z.infer<typeof SongMetadata>;

// An artist's metadata from the External Source, where an artist is a MusicBrainz artist of any
// type (ADR-0013, Artists). Their name, in its original script, is the title and the Original
// Title, and never a Ukrainian one. year and endYear are the years of their life-span: the begin
// year, and the end year when MusicBrainz has one, both null without a begin year. artistType is
// MusicBrainz's (Person, Group, Orchestra, Choir, Character, Other), country an ISO 3166-1 code,
// such as UA, or XW for worldwide, for the client to name, and disambiguation MusicBrainz's note
// that tells two artists of one name apart. The photo is the Wikidata entity's image on Wikimedia
// Commons, in a width for a thumbnail and one for the artist's page, credited by its author, when
// Commons names one, and its licence, linked to its file's page; with no photo the client shows
// the artist's initials, as it does when the image doesn't load. url is the artist on MusicBrainz.
// All but the name and the years are unknown until the details call succeeds.
export const ArtistMetadata = z
  .object({
    title: z.string().openapi({ example: "Океан Ельзи" }),
    originalTitle: z.string().openapi({ example: "Океан Ельзи" }),
    ukrainianTitle: z.null(),
    year: z.int().nullable().openapi({ example: 1994 }),
    endYear: z.int().nullable().openapi({ example: null }),
    artistType: z.string().nullable().openapi({ example: "Group" }),
    country: z.string().nullable().openapi({ example: "UA" }),
    disambiguation: z.string().nullable().openapi({ example: null }),
    photoUrls: z
      .object({
        small: z.url().openapi({
          example: "https://commons.wikimedia.org/wiki/Special:FilePath/OkeanElzi25.jpg?width=250",
        }),
        large: z.url().openapi({
          example: "https://commons.wikimedia.org/wiki/Special:FilePath/OkeanElzi25.jpg?width=500",
        }),
      })
      .nullable(),
    photoCredit: z
      .object({
        author: z.string().nullable().openapi({ example: "Alexander Khanin" }),
        licence: z.string().openapi({ example: "CC BY-SA 4.0" }),
        url: z
          .url()
          .openapi({ example: "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg" }),
      })
      .nullable(),
    url: z.url().nullable().openapi({
      example: "https://musicbrainz.org/artist/87a417d3-f118-43e0-bece-3de1bd90fce0",
    }),
  })
  .openapi("ArtistMetadata");

export type ArtistMetadata = z.infer<typeof ArtistMetadata>;

// A Media Item. A catalog-backed one's metadata comes from the disposable cache, so it is null
// while the cache has no entry for it. A Manual Media Item has no External Reference, and its
// metadata is what its User gave: never a poster, a backdrop or a Ukrainian title, and the title
// as its Original Title when it has none. Its metadata's shape depends on its Media Type, so a
// client doesn't compile until it handles every one.
export const FilmMediaItem = z
  .object({
    id: z.int().openapi({ example: 42 }),
    mediaType: z.literal("film"),
    externalReference: ExternalReference.nullable(),
    metadata: FilmMetadata.nullable(),
  })
  .openapi("FilmMediaItem");

export const BookMediaItem = z
  .object({
    id: z.int().openapi({ example: 43 }),
    mediaType: z.literal("book"),
    externalReference: ExternalReference.nullable(),
    metadata: BookMetadata.nullable(),
  })
  .openapi("BookMediaItem");

export const SeriesMediaItem = z
  .object({
    id: z.int().openapi({ example: 44 }),
    mediaType: z.literal("series"),
    externalReference: ExternalReference.nullable(),
    metadata: SeriesMetadata.nullable(),
  })
  .openapi("SeriesMediaItem");

// A game's Media Item, its metadata a game's.
export const GameMediaItem = z
  .object({
    id: z.int().openapi({ example: 45 }),
    mediaType: z.literal("game"),
    externalReference: ExternalReference.nullable(),
    metadata: GameMetadata.nullable(),
  })
  .openapi("GameMediaItem");

// An album's Media Item, its metadata an album's.
export const AlbumMediaItem = z
  .object({
    id: z.int().openapi({ example: 46 }),
    mediaType: z.literal("album"),
    externalReference: ExternalReference.nullable(),
    metadata: AlbumMetadata.nullable(),
  })
  .openapi("AlbumMediaItem");

// A song's Media Item, its metadata a song's.
export const SongMediaItem = z
  .object({
    id: z.int().openapi({ example: 47 }),
    mediaType: z.literal("song"),
    externalReference: ExternalReference.nullable(),
    metadata: SongMetadata.nullable(),
  })
  .openapi("SongMediaItem");

// An artist's Media Item, its metadata an artist's.
export const ArtistMediaItem = z
  .object({
    id: z.int().openapi({ example: 48 }),
    mediaType: z.literal("artist"),
    externalReference: ExternalReference.nullable(),
    metadata: ArtistMetadata.nullable(),
  })
  .openapi("ArtistMediaItem");

export const MediaItem = z
  .discriminatedUnion("mediaType", [
    FilmMediaItem,
    BookMediaItem,
    SeriesMediaItem,
    GameMediaItem,
    AlbumMediaItem,
    SongMediaItem,
    ArtistMediaItem,
  ])
  .openapi("MediaItem");

export type MediaItem = z.infer<typeof MediaItem>;

// One of the User's own Manual Media Items that matches a search, marked like a search result.
export const ManualSearchResult = z
  .object({
    mediaItem: MediaItem,
    ...UserMarks,
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

// A song search's rows as the browser found them on MusicBrainz (ADR-0013): the query, for the
// User's manual songs, and up to `songSearchLimit` recording MBIDs, comma-separated, or none.
export const SearchMarksQuery = z.object({
  mediaType: z.literal("song"),
  query: CatalogSearchQuery.shape.query,
  ids: z
    .string()
    .regex(new RegExp(`^(${mbidPattern}(,${mbidPattern})*)?$`))
    .optional()
    .transform((ids) => (ids ? ids.split(",") : []))
    .pipe(z.array(z.string()).max(songSearchLimit))
    .openapi({ type: "string", example: "d8d55f18-0c4b-4036-a16d-e273ac8953fc" }),
});

// The User's own matching manual songs, to be listed first, and each MBID's marks.
export const SearchMarksResponse = z
  .object({
    manualResults: z.array(ManualSearchResult),
    marks: z.record(z.string(), SearchMarks),
  })
  .openapi("SearchMarksResponse");

export type SearchMarksResponse = z.infer<typeof SearchMarksResponse>;

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
// when now is. A film's genres are TMDB's film genres, each at most once. A book's authors are
// names for display, trimmed, in the User's order; empty ones are dropped.
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

const ManualFilmYear = z.int().min(earliestFilmYear).nullable().openapi({ example: 1965 });

const ManualBookYear = z.int().min(earliestBookYear).nullable().openapi({ example: 2019 });

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

const ManualAuthors = z
  .array(z.string().trim().max(maxManualTitleLength))
  .max(maxManualAuthors)
  .openapi({ example: ["Тамара Горіха Зерня"] });

// A new Manual Media Item, with the details of its Media Type. One with the same Media Type and
// year as another of the User's, and a title or Original Title that is the other's title or
// Original Title, is refused as a possible duplicate unless allowDuplicate says to make it anyway.
export const NewManualFilmRequest = z
  .object({
    mediaType: z.literal("film"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualFilmYear.default(null),
    runtime: ManualRuntime.default(null),
    genres: ManualGenres.default([]),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualFilmRequest");

export type NewManualFilmRequest = z.input<typeof NewManualFilmRequest>;

export const NewManualBookRequest = z
  .object({
    mediaType: z.literal("book"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualBookYear.default(null),
    authors: ManualAuthors.default([]),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualBookRequest");

export type NewManualBookRequest = z.input<typeof NewManualBookRequest>;

// A series has no details beyond its titles and year: a User's seasons and episodes are their
// Progress, not the series' metadata.
export const NewManualSeriesRequest = z
  .object({
    mediaType: z.literal("series"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualFilmYear.default(null),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualSeriesRequest");

export type NewManualSeriesRequest = z.input<typeof NewManualSeriesRequest>;

// A game has a title, an Original Title and a year, as a series does: its platforms and developer
// aren't asked for.
export const NewManualGameRequest = z
  .object({
    mediaType: z.literal("game"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualFilmYear.default(null),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualGameRequest");

export type NewManualGameRequest = z.input<typeof NewManualGameRequest>;

// An album has a title, an Original Title, a year and its artists, which take a book's authors'
// field and rules (ADR-0013).
export const NewManualAlbumRequest = z
  .object({
    mediaType: z.literal("album"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualFilmYear.default(null),
    authors: ManualAuthors.default([]).openapi({ example: ["Океан Ельзи"] }),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualAlbumRequest");

export type NewManualAlbumRequest = z.input<typeof NewManualAlbumRequest>;

// A song has a title, an Original Title, its artists, in a manual album's field, and an optional
// year (ADR-0013).
export const NewManualSongRequest = z
  .object({
    mediaType: z.literal("song"),
    title: ManualTitle,
    originalTitle: ManualOriginalTitle.default(null),
    year: ManualFilmYear.default(null),
    authors: ManualAuthors.default([]).openapi({ example: ["Океан Ельзи"] }),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualSongRequest");

export type NewManualSongRequest = z.input<typeof NewManualSongRequest>;

// An artist has a name, as its title, and an optional Original Title, and no year (ADR-0013,
// Artists). Two of the User's artists with one name are possible duplicates, as two of their
// works with one title and no year are.
export const NewManualArtistRequest = z
  .object({
    mediaType: z.literal("artist"),
    title: ManualTitle.openapi({ example: "Сусіди" }),
    originalTitle: ManualOriginalTitle.default(null).openapi({ example: null }),
    allowDuplicate: z.boolean().default(false),
  })
  .strict()
  .openapi("NewManualArtistRequest");

export type NewManualArtistRequest = z.input<typeof NewManualArtistRequest>;

export const NewManualMediaItemRequest = z
  .discriminatedUnion("mediaType", [
    NewManualFilmRequest,
    NewManualBookRequest,
    NewManualSeriesRequest,
    NewManualGameRequest,
    NewManualAlbumRequest,
    NewManualSongRequest,
    NewManualArtistRequest,
  ])
  .openapi("NewManualMediaItemRequest");

export type NewManualMediaItemRequest = z.input<typeof NewManualMediaItemRequest>;

export type NewManualMediaItem = z.output<typeof NewManualMediaItemRequest>;

// Only the fields given change, by the same rules as a new one; a null or empty Original Title,
// or a null year or runtime, clears it. The Media Type can't change, and the Worker refuses the
// details of another Media Type: a book's or an album's runtime or genres, a film's, a series' or
// a game's authors, a series', a game's, an album's or a song's runtime or genres, or a year
// before films for any but a book. An album's or a song's authors are its artists. An artist takes
// a title and an Original Title alone.
export const ManualMediaItemEditRequest = z
  .object({
    title: ManualTitle.optional(),
    originalTitle: ManualOriginalTitle.optional(),
    // As early as any Media Type's year can be; the Worker holds a film's to films.
    year: ManualBookYear.optional(),
    runtime: ManualRuntime.optional(),
    genres: ManualGenres.optional(),
    authors: ManualAuthors.optional(),
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

// A new Log Entry, where its Media Item was in the User's Backlog before logging it took it off, or
// null when it wasn't there, and the Media Item's Current Rating and number of Log Entries now.
export const NewLogEntryResponse = LogEntryResponse.extend({
  removedFromBacklog: RemovedListItem.nullable(),
  currentRating: Rating,
  logEntryCount: z.int().positive().openapi({ example: 2 }),
}).openapi("NewLogEntryResponse");

export type NewLogEntryResponse = z.infer<typeof NewLogEntryResponse>;

// A series' Progress: the last episode the User watched (src/shared/progress.ts). The schema
// takes any numbers, so that a season or an episode out of range is refused as `invalid_progress`
// rather than as a malformed request; the document says what is accepted.
export const SeriesProgress = z
  .object({
    mediaType: z.literal("series"),
    season: z.number().openapi({ type: "integer", minimum: 1, example: 2 }),
    episode: z.number().openapi({
      type: "integer",
      minimum: 0,
      example: 5,
      description: "The last episode watched in the season; 0 when none is yet",
    }),
  })
  .openapi("SeriesProgress");

// A book's Progress: the page the User is on and, if they gave it, how many pages their edition
// has (src/shared/progress.ts). As for a series, the schema takes any numbers, so that one out of
// range, or a page past the page count, is refused as `invalid_progress`.
export const BookProgress = z
  .object({
    mediaType: z.literal("book"),
    page: z.number().openapi({
      type: "integer",
      minimum: 0,
      maximum: maxPage,
      example: 142,
      description: "The page the User is on; 0 when they haven't started",
    }),
    pageCount: z.number().optional().openapi({
      type: "integer",
      minimum: 1,
      maximum: maxPage,
      example: 380,
      description: "How many pages the User's edition has, never fewer than the page",
    }),
  })
  .openapi("BookProgress");

// How far a User has got in a Media Item In Progress, in a shape set by its Media Type, which it
// names (ADR-0005).
export const Progress = z
  .discriminatedUnion("mediaType", [SeriesProgress, BookProgress])
  .openapi("Progress");

// What follows from a series' Progress and the seasons its cache entry lists, worked out by
// seriesOutlook (src/shared/progress.ts), which the client shares.
export const SeriesOutlook = z
  .object({
    nextEpisode: SeriesEpisode.nullable().openapi({
      description:
        "The episode after the last watched, or the first of the next season that lists " +
        "episodes; null when the series lists none after it. Without seasons, as for a manual " +
        "series, the next number in the same season",
    }),
    watchedEpisodes: z.int().min(0).nullable().openapi({
      example: 15,
      description: "Episodes watched of all the seasons list; null without seasons",
    }),
    episodeCount: z.int().min(0).nullable().openapi({
      example: 62,
      description: "Episodes all the seasons list; null without seasons",
    }),
    caughtUp: z.boolean().openapi({
      description:
        "The User has watched the last episode that has aired, or none has aired; never true " +
        "without seasons",
    }),
  })
  .openapi("SeriesOutlook");

// A Media Item the User has started and not finished: since when, a calendar day they may leave
// out, and when they marked it. Where its Media Type has Progress, as a series and a book do, it
// carries the User's, or null when they haven't given one, and for a series what follows from it.
export const InProgress = z
  .object({
    startDate: LogDate.nullable(),
    createdAt: z.iso.datetime().openapi({ example: "2026-10-12T19:30:00.000Z" }),
    progress: Progress.nullable().optional(),
    outlook: SeriesOutlook.optional(),
  })
  .openapi("InProgress");

export type InProgress = z.infer<typeof InProgress>;

// Starts a Media Item. The start date follows a Log Entry date's rules, with timeZone setting the
// latest one allowed. A Progress, of the Media Item's Media Type, starts it part way, as "Watch
// more" starts a series from a season.
export const NewInProgressRequest = z
  .object({
    mediaItemId: z.int().positive().openapi({ example: 42 }),
    startDate: LogDate.nullable().default(null),
    progress: Progress.nullable().default(null),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
  })
  .openapi("NewInProgressRequest");

export type NewInProgressRequest = z.input<typeof NewInProgressRequest>;

// The new In Progress, and where its Media Item was in the User's Backlog before starting it took it
// off, or null when it wasn't there.
export const NewInProgressResponse = z
  .object({
    inProgress: InProgress,
    removedFromBacklog: RemovedListItem.nullable(),
  })
  .openapi("NewInProgressResponse");

export type NewInProgressResponse = z.infer<typeof NewInProgressResponse>;

// A new start date or Progress, or both; null clears either. Progress is sent whole, as an
// absolute value, so sending the same one twice changes nothing.
export const InProgressEditRequest = z
  .object({
    startDate: LogDate.nullable().optional(),
    progress: Progress.nullable().optional(),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
  })
  .strict()
  .refine((edit) => edit.startDate !== undefined || edit.progress !== undefined, {
    message: "Send a start date, a Progress or both",
  })
  .openapi("InProgressEditRequest");

export type InProgressEditRequest = z.infer<typeof InProgressEditRequest>;

export const InProgressResponse = z
  .object({
    inProgress: InProgress,
  })
  .openapi("InProgressResponse");

export type InProgressResponse = z.infer<typeof InProgressResponse>;

// Finishing a Media Item In Progress records a Log Entry for it, by a new Log Entry's rules.
export const FinishRequest = NewLogEntryRequest.omit({ mediaItemId: true }).openapi(
  "FinishRequest",
);

export type FinishRequest = z.input<typeof FinishRequest>;

// A Thought's text: plain, trimmed, 1 to `maxThoughtLength` characters.
const ThoughtText = z
  .string()
  .trim()
  .min(1)
  .max(maxThoughtLength)
  .openapi({ example: "Olena says it's her favourite." });

// The state a Media Item was in for the User when they wrote a Thought: on their Backlog, In
// Progress, Experienced, or none of these. In Progress wins over Experienced, as on a second
// viewing, and Experienced over Planned.
export const ThoughtState = z.enum(thoughtStates).openapi({ example: "planned" });

// A User's own Thought on a Media Item: its text, its date, whether it is a quote, where the User
// was in the Media Item, if anywhere, and the state it was written in, which never changes.
// createdAt orders a day's Thoughts.
export const Thought = z
  .object({
    id: z.int().openapi({ example: 9 }),
    mediaItemId: z.int().openapi({ example: 42 }),
    text: z.string().openapi({ example: "Olena says it's her favourite." }),
    date: LogDate,
    quote: z.boolean(),
    progress: Progress.nullable(),
    state: ThoughtState,
    createdAt: z.iso.datetime().openapi({ example: "2026-11-15T19:30:00.000Z" }),
  })
  .openapi("Thought");

export type Thought = z.infer<typeof Thought>;

// A new Thought. The date follows a Log Entry date's rules, with timeZone setting the latest one
// allowed. The Progress, of the Media Item's Media Type, is kept as given: the client fills it
// from the In Progress, and the User may change or clear it.
export const NewThoughtRequest = z
  .object({
    text: ThoughtText,
    date: LogDate,
    quote: z.boolean().default(false),
    progress: Progress.nullable().default(null),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
  })
  .openapi("NewThoughtRequest");

export type NewThoughtRequest = z.input<typeof NewThoughtRequest>;

// Only the fields given change, by the same rules as a new Thought; a null Progress clears it. The
// state and the creation time never change.
export const ThoughtEditRequest = z
  .object({
    text: ThoughtText.optional(),
    date: LogDate.optional(),
    quote: z.boolean().optional(),
    progress: Progress.nullable().optional(),
    timeZone: z.string().max(100).optional().openapi({ example: "Europe/Kyiv" }),
  })
  .strict()
  .openapi("ThoughtEditRequest");

export type ThoughtEditRequest = z.input<typeof ThoughtEditRequest>;

export const ThoughtParams = z.object({
  thoughtId: z.coerce.number().int().positive().openapi({ example: 9 }),
});

export const ThoughtResponse = z
  .object({
    thought: Thought,
  })
  .openapi("ThoughtResponse");

export type ThoughtResponse = z.infer<typeof ThoughtResponse>;

export const LibraryQuery = z.object({
  mediaType: MediaType,
});

// One Media Item of a User's Library: in their Backlog, with when it was added there, In Progress,
// or with at least one of their Log Entries, with its Current Rating and the date and creation time
// of the last Log Entry in Log Order, or any of these together. That entry's date is null when no
// entry is dated.
export const LibraryItem = z
  .object({
    mediaItem: MediaItem,
    backlog: z
      .object({
        addedAt: z.iso.datetime().openapi({ example: "2026-10-19T19:30:00.000Z" }),
      })
      .nullable(),
    inProgress: InProgress.nullable(),
    log: z
      .object({
        currentRating: Rating,
        lastLogEntry: z.object({
          date: LogDate.nullable(),
          createdAt: z.iso.datetime().openapi({ example: "2026-10-19T19:30:00.000Z" }),
        }),
      })
      .nullable(),
  })
  .openapi("LibraryItem");

export type LibraryItem = z.infer<typeof LibraryItem>;

// The User's Library of one Media Type, each Media Item once, in no particular order: the client
// sorts and filters it.
export const LibraryResponse = z
  .object({
    items: z.array(LibraryItem),
  })
  .openapi("LibraryResponse");

export type LibraryResponse = z.infer<typeof LibraryResponse>;

export const LogResponse = z
  .object({
    logEntries: z.array(LogEntry),
  })
  .openapi("LogResponse");

export type LogResponse = z.infer<typeof LogResponse>;

export const MediaItemParams = z.object({
  mediaItemId: z.coerce.number().int().positive().openapi({ example: 42 }),
});

// A text in English and in Ukrainian, as the source has it, null where it has none.
const LocalizedText = z.object({
  en: z.string().nullable(),
  uk: z.string().nullable(),
});

// What a film's page shows in its About block, as TMDB has it: the overview unedited, every
// director and the first 5 of the cast, in TMDB's order.
export const FilmAbout = z
  .object({
    mediaType: z.literal("film"),
    overview: LocalizedText.openapi({
      example: { en: "During its return to the earth…", uk: "У далекому майбутньому…" },
    }),
    tagline: LocalizedText.openapi({
      example: { en: "In space no one can hear you scream.", uk: null },
    }),
    directors: z.array(z.string()).openapi({ example: ["Ridley Scott"] }),
    cast: z.array(z.string()).openapi({ example: ["Tom Skerritt", "Sigourney Weaver"] }),
  })
  .openapi("FilmAbout");

// What a series' page shows in its About block, as a film's does, with its creators in the
// directors' place, in TMDB's order.
export const SeriesAbout = z
  .object({
    mediaType: z.literal("series"),
    overview: LocalizedText.openapi({
      example: { en: "The true story of one of the worst…", uk: "Сюжет розгортається 1986 року…" },
    }),
    tagline: LocalizedText.openapi({
      example: { en: "What is the cost of lies?", uk: "Яка ціна брехні?" },
    }),
    creators: z.array(z.string()).openapi({ example: ["Craig Mazin"] }),
    cast: z.array(z.string()).openapi({ example: ["Jared Harris", "Stellan Skarsgård"] }),
  })
  .openapi("SeriesAbout");

// What a book's page shows in its About block: Open Library's description of the work, in whatever
// language it was typed, its Markdown links shown as their text and its paragraphs kept.
export const BookAbout = z
  .object({
    mediaType: z.literal("book"),
    description: z.string().openapi({
      example: "Turning the envelope over, his hand trembling, Harry saw…\n\nHARRY POTTER has…",
    }),
  })
  .openapi("BookAbout");

// What a game's page shows in its About block: IGDB's summary, unedited, and its genres, in
// IGDB's order.
export const GameAbout = z
  .object({
    mediaType: z.literal("game"),
    summary: z.string().nullable().openapi({
      example: "The Witcher 3: Wild Hunt is an open-world action role-playing game…",
    }),
    genres: z.array(z.string()).openapi({ example: ["Role-playing (RPG)", "Adventure"] }),
  })
  .openapi("GameAbout");

// What an artist's page shows of them beside their metadata, with no About block of its own: their
// albums list (ADR-0013, Artists), the studio Albums and EPs MusicBrainz has of them, at most 100,
// oldest first by first release, a missing date last, then by title. Each opens its album's page
// by its release-group MBID and shows its cover, as an album's coverUrls do.
export const ArtistAbout = z
  .object({
    mediaType: z.literal("artist"),
    albums: z.array(
      z.object({
        mbid: z.string().openapi({ example: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8" }),
        title: z.string().openapi({ example: "Земля" }),
        year: z.int().nullable().openapi({ example: 2013 }),
        primaryType: z.enum(["Album", "EP"]).openapi({ example: "Album" }),
        coverUrls: AlbumMetadata.shape.coverUrls.unwrap(),
      }),
    ),
  })
  .openapi("ArtistAbout");

// What a Media Item's page shows in its About block, by its Media Type, and for an artist their
// albums.
export const About = z
  .discriminatedUnion("mediaType", [FilmAbout, SeriesAbout, BookAbout, GameAbout, ArtistAbout])
  .openapi("About");

export type About = z.infer<typeof About>;

// One User's Item History of a Media Item: every Log Entry for it in Log Order, every Thought on it
// by date with creation time breaking ties, the Current Rating, which is the last Log Entry's
// Rating, whether it is in their Backlog, and since when it is In Progress, if it is. A Media Item
// the User hasn't experienced has neither Log Entries nor a Current Rating.
// `about` is what its page says the Media Item is about, from the catalog cache, or null when there
// is nothing to show: for a Manual Media Item, and for an entry with no details yet.
export const ItemHistoryResponse = z
  .object({
    mediaItem: MediaItem,
    logEntries: z.array(LogEntry),
    thoughts: z.array(Thought),
    currentRating: Rating.nullable(),
    inBacklog: z.boolean(),
    inProgress: InProgress.nullable(),
    about: About.nullable(),
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

// The Media Types that have a Backlog: all but the light ones, a song and an artist (ADR-0005).
export const BacklogMediaType = MediaType.exclude(lightMediaTypes).openapi({ example: "film" });

export type BacklogMediaType = z.infer<typeof BacklogMediaType>;

export const BacklogQuery = z.object({
  mediaType: BacklogMediaType,
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

// One of the User's own Lists as the Lists read gives it: its summary, its first Media Items in
// List order, and whether it has a Share Link.
export const ListPreview = ListSummary.extend({
  covers: z.array(MediaItem).max(listCoverCount),
  shared: z.boolean().openapi({ description: "Whether the List has a Share Link" }),
}).openapi("ListPreview");

export type ListPreview = z.infer<typeof ListPreview>;

export const ListsResponse = z
  .object({
    lists: z.array(ListPreview),
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

// One of the User's Lists, with the List Item that holds a given Media Item, or null, and its first
// Media Item in List order, for its cover, or null while it is empty.
export const MediaItemList = ListSummary.extend({
  listItem: ListItemPlace.nullable(),
  firstMediaItem: MediaItem.nullable(),
}).openapi("MediaItemList");

export type MediaItemList = z.infer<typeof MediaItemList>;

export const MediaItemListsResponse = z
  .object({
    lists: z.array(MediaItemList),
  })
  .openapi("MediaItemListsResponse");

export type MediaItemListsResponse = z.infer<typeof MediaItemListsResponse>;

export const ListedMediaItemsQuery = z.object({
  mediaType: MediaType,
});

// A Media Item on at least one of the User's own Lists, and those Lists, oldest first.
export const ListedMediaItem = z
  .object({
    mediaItem: MediaItem,
    lists: z.array(HoldingList).min(1),
  })
  .openapi("ListedMediaItem");

export type ListedMediaItem = z.infer<typeof ListedMediaItem>;

// Every Media Item of one Media Type on the User's own Lists, each once, in no particular order.
export const ListedMediaItemsResponse = z
  .object({
    items: z.array(ListedMediaItem),
  })
  .openapi("ListedMediaItemsResponse");

export type ListedMediaItemsResponse = z.infer<typeof ListedMediaItemsResponse>;

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

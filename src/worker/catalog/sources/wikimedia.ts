// An artist's photo from Wikidata and Wikimedia Commons (ADR-0013, Artists): the Wikidata entity's
// P18 image, shown through Commons' Special:FilePath, and credited by its author and licence as
// Commons has them. Two calls after the artist's MusicBrainz lookup, one at a time, outside
// MusicBrainz's queue. A Wikimedia failure never fails an add or a refresh, and never counts
// toward unavailability: the artist shows their initials, or keeps a photo read before.
import { z } from "zod";
import type { CatalogEnv } from "../source";
import { userAgentOf } from "./musicbrainz";

// Wikidata's P18 claims of one entity, from wbgetclaims: each with its rank and file name.
const Claims = z.object({
  claims: z.record(
    z.string(),
    z.array(
      z.object({
        rank: z.string(),
        mainsnak: z.object({
          datavalue: z.object({ value: z.string() }).optional(),
        }),
      }),
    ),
  ),
});

// The file name of an entity's photo: its first P18 image of preferred rank, otherwise its first of
// normal rank, never a deprecated one. Null for an entity with none; undefined for an answer of
// unknown shape.
export function photoFileOf(answer: unknown): string | null | undefined {
  const parsed = Claims.safeParse(answer);
  if (!parsed.success) return undefined;
  const images = (parsed.data.claims.P18 ?? []).flatMap((claim) => {
    const file = claim.mainsnak.datavalue?.value;
    return file ? [{ file, rank: claim.rank }] : [];
  });
  const chosen =
    images.find((image) => image.rank === "preferred") ??
    images.find((image) => image.rank === "normal");
  return chosen?.file ?? null;
}

// Commons' image info of one file, with the fields of its metadata we use.
const ImageInfo = z.object({
  query: z.object({
    pages: z.record(
      z.string(),
      z.object({
        missing: z.string().optional(),
        imageinfo: z
          .array(
            z.object({
              descriptionurl: z.url(),
              extmetadata: z.object({
                Artist: z.object({ value: z.string() }).optional(),
                LicenseShortName: z.object({ value: z.string().trim().min(1) }),
              }),
            }),
          )
          .optional(),
      }),
    ),
  }),
});

// A photo's credit: its author, when Commons names one, its licence and its file's page on Commons,
// which carries the licence in full.
export interface PhotoCredit {
  author: string | null;
  licence: string;
  url: string;
}

// The characters an author's HTML may write as entities.
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// The text content of an HTML fragment, as a User reads it: its markup dropped, its entities
// decoded and its whitespace collapsed ("Koh Hasebe; Distributed by Elektra Records").
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
      }
      if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
      return entities[name.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([,;.])/g, "$1")
    .trim();
}

// The credit of a file from Commons' answer: the text of `Artist`, its `LicenseShortName` and its
// `descriptionurl`. Null for a file Commons doesn't have; undefined for an answer of unknown shape,
// one without a licence among them.
export function photoCreditOf(answer: unknown): PhotoCredit | null | undefined {
  const parsed = ImageInfo.safeParse(answer);
  if (!parsed.success) return undefined;
  const [page] = Object.values(parsed.data.query.pages);
  if (!page || page.missing !== undefined) return null;
  const [info] = page.imageinfo ?? [];
  if (!info) return undefined;
  const author = textOf(info.extmetadata.Artist?.value ?? "");
  return {
    author: author || null,
    licence: info.extmetadata.LicenseShortName.value,
    url: info.descriptionurl,
  };
}

// An artist's Wikidata ID from their lookup's `wikidata` URL relation, or null without one.
export function wikidataIdOf(
  relations: readonly { type: string; url?: { resource: string } | undefined }[] | null | undefined,
): string | null {
  for (const relation of relations ?? []) {
    if (relation.type !== "wikidata") continue;
    const id = /^https:\/\/www\.wikidata\.org\/wiki\/(Q\d+)$/.exec(relation.url?.resource ?? "");
    if (id?.[1]) return id[1];
  }
  return null;
}

// A Wikimedia call failed, timed out or answered in a shape we don't know.
export class WikimediaUnavailable extends Error {}

// An artist's photo as their entry keeps it: its Commons file name and credit.
export interface ReadPhoto extends PhotoCredit {
  file: string;
}

// How long one call may take before it counts as unanswered.
const callTimeout = 10_000;

// The end of the last Wikimedia call, so this isolate makes one at a time.
let queueTail: Promise<void> = Promise.resolve();

// Runs `call` once every Wikimedia call queued before it has ended.
async function oneAtATime<T>(call: () => Promise<T>): Promise<T> {
  const previous = queueTail;
  let release = () => {};
  queueTail = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    return await call();
  } finally {
    release();
  }
}

// One GET of a Wikimedia API, and its JSON body. It says who is asking, as Wikimedia's policy asks,
// with the TasteTrack User-Agent MusicBrainz gets.
async function getJson(env: CatalogEnv, url: URL): Promise<unknown> {
  return oneAtATime(async () => {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(callTimeout),
        headers: {
          "User-Agent": userAgentOf(env),
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new WikimediaUnavailable(`Wikimedia ${url.pathname} answered ${response.status}`);
      }
      return await response.json().catch(() => {
        throw new WikimediaUnavailable(`Wikimedia ${url.pathname} answered with no JSON`);
      });
    } catch (error) {
      if (error instanceof WikimediaUnavailable) throw error;
      throw new WikimediaUnavailable(`Wikimedia ${url.pathname} failed`, { cause: error });
    }
  });
}

// The Wikidata entity's photo, by two calls: its P18 claims for the file name, then Commons for the
// credit. Null when it has no P18 or Commons doesn't have the file. Throws WikimediaUnavailable.
export async function readPhoto(env: CatalogEnv, wikidataId: string): Promise<ReadPhoto | null> {
  const claimsUrl = new URL(`${env.WIKIDATA_BASE_URL}/w/api.php`);
  claimsUrl.search = new URLSearchParams({
    action: "wbgetclaims",
    entity: wikidataId,
    property: "P18",
    format: "json",
  }).toString();
  const file = photoFileOf(await getJson(env, claimsUrl));
  if (file === undefined) throw new WikimediaUnavailable("Wikidata answered in an unknown shape");
  if (file === null) return null;
  const infoUrl = new URL(`${env.COMMONS_BASE_URL}/w/api.php`);
  infoUrl.search = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    titles: `File:${file}`,
    format: "json",
  }).toString();
  const credit = photoCreditOf(await getJson(env, infoUrl));
  if (credit === undefined) throw new WikimediaUnavailable("Commons answered in an unknown shape");
  return credit && { file, ...credit };
}

// The address of a file's image on Commons, which redirects to a thumbnail in the width asked for.
export function filePathOf(env: CatalogEnv, file: string): string {
  return `${env.COMMONS_BASE_URL}/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}

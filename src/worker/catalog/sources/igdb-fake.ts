// An IGDB fake with fixed data, mounted among the test hooks so that the `local` Worker searches it
// instead of the real IGDB (wrangler.jsonc). It answers Twitch's token call too, and like IGDB
// reads an Apicalypse query: the search, the fields asked for, the Media Item filter and an ID.
// Its games mirror real IGDB data (checked 2026-11-19), so the same tests pass here and against
// IGDB on staging.
import { Hono } from "hono";

interface FakeCompany {
  name: string;
  developer: boolean;
}

interface FakeGame {
  id: number;
  name: string;
  alternativeNames?: string[];
  // IGDB's IDs: 0 main game, 1 DLC, 2 expansion, 3 bundle, 4 standalone expansion, 5 mod, 8 remake,
  // 9 remaster, 10 expanded game, 11 port, 14 update; a game_status of 6 is cancelled.
  gameType: number;
  gameStatus?: number;
  versionParent?: number;
  parentGame?: number;
  // Seconds since the epoch; none for a game that never came out.
  firstReleaseDate?: number;
  cover?: string;
  // Each platform's abbreviation and name.
  platforms: [abbreviation: string | null, name: string][];
  companies: FakeCompany[];
  genres: string[];
  summary?: string;
  url: string;
  artworks: string[];
  screenshots: string[];
}

// The platforms of a game on sale today, as The Witcher 3 and Crisis Core's remaster list them.
const currentPlatforms: FakeGame["platforms"] = [
  ["Series X|S", "Xbox Series X|S"],
  ["PS4", "PlayStation 4"],
  ["Switch 2", "Nintendo Switch 2"],
  ["PC", "PC (Microsoft Windows)"],
  ["PS5", "PlayStation 5"],
  ["XONE", "Xbox One"],
  ["Switch", "Nintendo Switch"],
];

const witcherGenres = ["Role-playing (RPG)", "Adventure"];

const cdProjektRed = { name: "CD Projekt RED", developer: true };

const games: FakeGame[] = [
  // A main game, found with its DLC, expansions, editions, a bundle, an update and a mod, which
  // follow it.
  {
    id: 1942,
    name: "The Witcher 3: Wild Hunt",
    gameType: 0,
    firstReleaseDate: 1431993600,
    cover: "coaarl",
    platforms: currentPlatforms,
    companies: [
      { name: "WB Games", developer: false },
      { name: "cdp.pl", developer: false },
      { name: "Spike Chunsoft", developer: false },
      { name: "Bandai Namco Entertainment", developer: false },
      { name: "D3T Limited", developer: false },
      { name: "Saber Interactive", developer: false },
      cdProjektRed,
    ],
    genres: witcherGenres,
    summary:
      "The Witcher 3: Wild Hunt is an open-world action role-playing game developed by CD Projekt Red.\n\n" +
      "Set in a dark fantasy world, the game follows Geralt of Rivia, a monster hunter searching for his adopted daughter, Ciri, while navigating political conflicts and supernatural threats. Gameplay features exploration, combat, character progression, and branching narratives shaped by player choices. Widely acclaimed for its writing, world-building, and depth, it is considered one of the most influential RPGs of its generation.",
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt",
    artworks: ["ar6ijr", "ar3lze"],
    screenshots: ["sctj8u", "farvemmmxav0bgt6wx7t"],
  },
  {
    id: 141472,
    name: "The Witcher 3: Wild Hunt + Dark Souls III",
    gameType: 3,
    firstReleaseDate: 1540512000,
    cover: "co7zoz",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["XONE", "Xbox One"],
    ],
    companies: [],
    genres: witcherGenres,
    summary: "A bundle containing The Witcher 3: Wild Hunt and Dark Souls III.",
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-plus-dark-souls-iii",
    artworks: [],
    screenshots: ["scjsar", "scjsas"],
  },
  {
    id: 415005,
    name: "The Witcher 3: Wild Hunt Remastered",
    gameType: 14,
    parentGame: 1942,
    firstReleaseDate: 1790640000,
    cover: "cocrjd",
    platforms: [
      ["Series X|S", "Xbox Series X|S"],
      ["Switch 2", "Nintendo Switch 2"],
      ["PC", "PC (Microsoft Windows)"],
      ["PS5", "PlayStation 5"],
    ],
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-remastered",
    artworks: ["ar6hnf", "ar6hng"],
    screenshots: ["sc14wre", "sc14wr9"],
  },
  {
    id: 22439,
    name: "The Witcher 3: Wild Hunt - Game of the Year Edition",
    gameType: 3,
    versionParent: 1942,
    firstReleaseDate: 1472428800,
    cover: "co1wz4",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["PC", "PC (Microsoft Windows)"],
      ["XONE", "Xbox One"],
    ],
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-game-of-the-year-edition",
    artworks: ["ar10ce", "ar10cd"],
    screenshots: ["pziw7giojvmp8baw617b", "zvijqp04apwmzqvlgxej"],
  },
  {
    id: 13166,
    name: "The Witcher 3: Wild Hunt - Blood and Wine",
    gameType: 2,
    parentGame: 1942,
    firstReleaseDate: 1464566400,
    cover: "co2lgo",
    platforms: currentPlatforms.filter(([abbreviation]) => abbreviation !== "Switch 2"),
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-blood-and-wine",
    artworks: ["ar3nle", "ar3nld"],
    screenshots: ["iuzxf8iboeyxkggywbsj", "ixuz3ti1kiqnlzrtodnf"],
  },
  {
    id: 283715,
    name: "The Witcher 3: Enhanced Edition - Redux",
    gameType: 5,
    parentGame: 1942,
    firstReleaseDate: 1624579200,
    cover: "co7nxw",
    platforms: [["PC", "PC (Microsoft Windows)"]],
    companies: [],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-enhanced-edition-redux",
    artworks: [],
    screenshots: ["scvvzw"],
  },
  {
    id: 12503,
    name: "The Witcher 3: Wild Hunt - Hearts of Stone",
    gameType: 2,
    parentGame: 1942,
    firstReleaseDate: 1444608000,
    cover: "co1t7q",
    platforms: currentPlatforms.filter(([abbreviation]) => abbreviation !== "Switch 2"),
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-hearts-of-stone",
    artworks: ["ar3nlj", "jzhdplqbzx4vnywl7tpa"],
    screenshots: ["lz3gmntnjo5fojxzvrg5", "wrke9dxtduvuubfrm0kq"],
  },
  // An edition kept as a main game, with a version_parent.
  {
    id: 44549,
    name: "The Witcher 3: Wild Hunt - Collector's Edition",
    gameType: 0,
    versionParent: 1942,
    firstReleaseDate: 1434672000,
    cover: "co2lgn",
    platforms: [["PS4", "PlayStation 4"]],
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-collectors-edition",
    artworks: [],
    screenshots: ["y8caw9l1xoy5ucqoz2ge", "scvvzv"],
  },
  {
    id: 170450,
    name: "The Witcher 3: Wild Hunt - New Quest 'Fool's Gold'",
    gameType: 1,
    parentGame: 1942,
    firstReleaseDate: 1433808000,
    cover: "co5mwa",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["PC", "PC (Microsoft Windows)"],
      ["XONE", "Xbox One"],
    ],
    companies: [cdProjektRed],
    genres: witcherGenres,
    url: "https://www.igdb.com/games/the-witcher-3-wild-hunt-new-quest-fools-gold",
    artworks: [],
    screenshots: ["scdh2w", "scsry9"],
  },
  // A standalone expansion, a game of its own, though it has a parent game.
  {
    id: 107300,
    name: "Thronebreaker: The Witcher Tales",
    gameType: 4,
    parentGame: 19474,
    firstReleaseDate: 1540252800,
    cover: "co1qsk",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["Android", "Android"],
      ["PC", "PC (Microsoft Windows)"],
      ["iOS", "iOS"],
      ["XONE", "Xbox One"],
      ["Switch", "Nintendo Switch"],
    ],
    companies: [cdProjektRed],
    genres: [
      "Puzzle",
      "Role-playing (RPG)",
      "Strategy",
      "Turn-based strategy (TBS)",
      "Adventure",
      "Card & Board Game",
    ],
    url: "https://www.igdb.com/games/thronebreaker-the-witcher-tales",
    artworks: ["ar8hq", "ar8hr"],
    screenshots: ["djx8jtil83afqtzqj6qa", "ykbfjkhqobxasarq5gt2"],
  },
  // A game with a Russian alternative name, which a Cyrillic query matches, and no Ukrainian one.
  // Its developer isn't the first of its companies.
  {
    id: 320,
    name: "S.T.A.L.K.E.R.: Shadow of Chernobyl",
    alternativeNames: [
      "S.T.A.L.K.E.R.: Тень Чернобыля",
      "SSoC",
      "S.T.A.L.K.E.R.: Shadow of Chornobyl",
      "STALKER: Shadow of Chernobyl",
      "STALKER: Shadow of Chornobyl",
      "STALKER SoC",
      "Сталкер: Тень Чернобыля",
      "Сталкер",
    ],
    gameType: 0,
    firstReleaseDate: 1174608000,
    cover: "coa4s4",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["PC", "PC (Microsoft Windows)"],
      ["XONE", "Xbox One"],
      ["Switch", "Nintendo Switch"],
    ],
    companies: [
      { name: "THQ", developer: false },
      { name: "GSC World Publishing", developer: false },
      { name: "Deep Silver", developer: false },
      { name: "cdp.pl", developer: false },
      { name: "GSC Game World", developer: true },
      { name: "Mataboo", developer: false },
    ],
    genres: ["Shooter", "Role-playing (RPG)"],
    summary:
      "S.T.A.L.K.E.R.: Shadow of Chernobyl is a first-person shooter with role-playing and survival elements, and the first game in the S.T.A.L.K.E.R. series. It is set in an open, hazardous area known as the Zone, based on the Chernobyl exclusion zone, where players explore wilderness, settlements, and military sites in search of valuable artifacts. Beyond combat against human factions and mutated creatures, players must contend with pockets of altered physics called anomalies, radiation, hunger, and bleeding, managing supplies and equipment to survive. A non-linear storyline offers multiple endings, and limited trading and dialogue with other characters shape the experience.",
    url: "https://www.igdb.com/games/s-t-a-l-k-e-r-shadow-of-chernobyl",
    artworks: ["ar3uc9", "ar3uc7"],
    screenshots: ["scxwzv", "scxwzk"],
  },
  // One title, five games: the 1997 PS1 game, with no artworks or screenshots...
  {
    id: 393025,
    name: "Final Fantasy VII",
    gameType: 0,
    firstReleaseDate: 854668800,
    cover: "cobny6",
    platforms: [["PS1", "PlayStation"]],
    companies: [
      { name: "Square", developer: false },
      { name: "Square Product Development Division 1", developer: true },
    ],
    genres: ["Role-playing (RPG)", "Adventure"],
    summary:
      "Final Fantasy VII (note: this is the original Japan-exclusive version) is a role-playing game set in a post-modern, steampunk world where technology and fantasy elements coexist. Players control Cloud Strife, an ex-soldier who joins the eco-terrorist group AVALANCHE to oppose Shinra Inc., a corporation draining the planet's life energy. The game features turn-based combat with an active time element, a customizable Materia system for abilities, and unique Limit Break attacks for each character. Players explore 3D environments, engage in various mini-games, and uncover a complex plot involving Cloud's mysterious past and a powerful threat to the world. As the story progresses, players gain access to different vehicles, allowing them to explore new areas and uncover additional content.",
    url: "https://www.igdb.com/games/final-fantasy-vii--12",
    artworks: [],
    screenshots: [],
  },
  // ...its International edition, an expanded game...
  {
    id: 427,
    name: "Final Fantasy VII",
    gameType: 10,
    parentGame: 393025,
    firstReleaseDate: 873590400,
    cover: "co2kx2",
    platforms: [
      ["PS3", "PlayStation 3"],
      ["PS1", "PlayStation"],
      ["PSP", "PlayStation Portable"],
    ],
    companies: [{ name: "Square Product Development Division 1", developer: true }],
    genres: ["Role-playing (RPG)", "Adventure"],
    url: "https://www.igdb.com/games/final-fantasy-vii",
    artworks: ["ypvk6vrobhtnm68obkte", "nmo81hvssfppjxm0f3od"],
    screenshots: ["schnqk", "schnql"],
  },
  // ...a port...
  {
    id: 207026,
    name: "Final Fantasy VII",
    gameType: 11,
    parentGame: 392808,
    firstReleaseDate: 1449273600,
    cover: "cobn9o",
    platforms: [
      ["PS4", "PlayStation 4"],
      ["PC", "PC (Microsoft Windows)"],
      ["XONE", "Xbox One"],
      ["Switch", "Nintendo Switch"],
    ],
    companies: [
      { name: "Square Enix Business Division 3", developer: true },
      { name: "DotEmu", developer: true },
    ],
    genres: ["Role-playing (RPG)"],
    url: "https://www.igdb.com/games/final-fantasy-vii--6",
    artworks: ["ar609d", "ar1qho"],
    screenshots: ["sc12e30", "sc12e31"],
  },
  // ...the 2005 Famicom game, a game of its own, whose platform's abbreviation is lower case, with
  // screenshots and no artworks...
  {
    id: 2406,
    name: "Final Fantasy VII",
    gameType: 0,
    firstReleaseDate: 1135987200,
    cover: "co2059",
    platforms: [["famicom", "Family Computer"]],
    companies: [{ name: "Shenzhen Nanjing Technology", developer: true }],
    genres: ["Role-playing (RPG)"],
    summary:
      'Final Fantasy VII is an unlicensed "Shanzhai" demake of SquareSoft role-playing game of the same name, originally released for PlayStation in 1997. This two-dimensional "port" was developed and published by Chinese company Shenzhen Nanjing Technology for Subor, a Nintendo\'s Family Computer clone console series (internationally known as the NES). The cartridge itself is unique, as it is structurally different from licensed Famicom cartridges in terms of hardware and programming.',
    url: "https://www.igdb.com/games/final-fantasy-vii--1",
    artworks: [],
    screenshots: ["xjwibri1jvrigpy7se8u", "fmjaj3nputmnfpq9rgfm"],
  },
  // ...the 2020 remake, and a remaster of another of its games, each a game of its own...
  {
    id: 11169,
    name: "Final Fantasy VII Remake",
    gameType: 8,
    parentGame: 427,
    firstReleaseDate: 1586476800,
    cover: "cobcwt",
    platforms: [
      ["Series X|S", "Xbox Series X|S"],
      ["PS4", "PlayStation 4"],
      ["Switch 2", "Nintendo Switch 2"],
      ["PC", "PC (Microsoft Windows)"],
      ["PS5", "PlayStation 5"],
    ],
    companies: [{ name: "Square Enix Creative Business Unit I", developer: true }],
    genres: ["Role-playing (RPG)", "Adventure"],
    url: "https://www.igdb.com/games/final-fantasy-vii-remake",
    artworks: ["ar5c45", "ar5s4"],
    screenshots: ["sc6viw", "sc6viz"],
  },
  {
    id: 205201,
    name: "Crisis Core: Final Fantasy VII - Reunion",
    gameType: 9,
    parentGame: 2407,
    firstReleaseDate: 1670889600,
    cover: "cobjb3",
    platforms: currentPlatforms,
    companies: [
      { name: "Tose", developer: true },
      { name: "Square Enix Creative Business Unit I", developer: true },
    ],
    genres: ["Role-playing (RPG)"],
    url: "https://www.igdb.com/games/crisis-core-final-fantasy-vii-reunion",
    artworks: ["ar1vdj"],
    screenshots: ["schgic", "schgib"],
  },
  // ...and the cancelled Super Famicom one.
  {
    id: 381337,
    name: "Final Fantasy VII",
    gameType: 0,
    gameStatus: 6,
    platforms: [["SFAM", "Super Famicom"]],
    companies: [{ name: "Square", developer: true }],
    genres: ["Role-playing (RPG)"],
    url: "https://www.igdb.com/games/final-fantasy-vii--10",
    artworks: [],
    screenshots: [],
  },
  // A game without a cover, artworks or screenshots.
  {
    id: 365395,
    name: "Spirit Glaive",
    gameType: 0,
    firstReleaseDate: 1500163200,
    platforms: [["PC", "PC (Microsoft Windows)"]],
    companies: [{ name: "AdamKruschwitz", developer: true }],
    genres: ["Platform", "Indie"],
    summary: "Slice and dice your way out of the weapons facility.",
    url: "https://www.igdb.com/games/spirit-glaive",
    artworks: [],
    screenshots: [],
  },
];

// A game whose details the fake fails, the way IGDB does when it is down.
const detailsFailureId = 999_000_001;

// Searching for this makes the fake fail the way IGDB does when it is down.
const failingQuery = "igdb fake failure";

// Searching for this and a number finds a game of that ID that isn't in `games`, so a test can
// watch a game no one has added join the catalog, on a local D1 that outlives each test run. Like
// a game IGDB has just deleted, it has no details.
const newGameQuery = /^igdb fake new game (\d+)$/;

function newGame(id: number): FakeGame {
  return {
    id,
    name: `New game ${id}`,
    gameType: 0,
    firstReleaseDate: 1577836800,
    platforms: [["PC", "PC (Microsoft Windows)"]],
    companies: [],
    genres: [],
    url: `https://www.igdb.com/games/new-game-${id}`,
    artworks: [],
    screenshots: [],
  };
}

// A game as IGDB holds it, with every field we may ask for expanded. IGDB gives every object its
// ID; the fake numbers the expanded ones by their place.
function record(game: FakeGame) {
  const numbered = <T>(items: T[]) => items.map((item, index) => ({ id: index + 1, ...item }));
  return {
    id: game.id,
    name: game.name,
    game_type: game.gameType,
    game_status: game.gameStatus,
    version_parent: game.versionParent,
    parent_game: game.parentGame,
    first_release_date: game.firstReleaseDate,
    cover: game.cover && { id: 1, image_id: game.cover },
    platforms: numbered(
      game.platforms.map(([abbreviation, name]) => ({
        ...(abbreviation && { abbreviation }),
        name,
      })),
    ),
    involved_companies: numbered(
      game.companies.map(({ name, developer }, index) => ({
        developer,
        company: { id: index + 100, name },
      })),
    ),
    genres: numbered(game.genres.map((name) => ({ name }))),
    summary: game.summary,
    url: game.url,
    artworks: numbered(game.artworks.map((image_id) => ({ image_id }))),
    screenshots: numbered(game.screenshots.map((image_id) => ({ image_id }))),
  };
}

type FieldTree = Map<string, FieldTree>;

// The fields an Apicalypse query asks for, as a tree: "platforms.abbreviation" asks for the
// abbreviation of each platform.
function fieldTree(fields: string[]): FieldTree {
  const tree: FieldTree = new Map();
  for (const field of fields) {
    let node = tree;
    for (const part of field.split(".")) {
      const next = node.get(part) ?? new Map();
      node.set(part, next);
      node = next;
    }
  }
  return tree;
}

// Only the fields asked for, as IGDB answers: an expanded object keeps its ID and the subfields
// asked for, and a field with no value is left out.
function picked(value: unknown, tree: FieldTree): unknown {
  if (Array.isArray(value)) return value.map((item) => picked(item, tree));
  if (typeof value !== "object" || value === null || tree.size === 0) return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = { id: source.id };
  for (const [field, subtree] of tree) {
    const item = source[field];
    if (item === undefined || (Array.isArray(item) && item.length === 0)) continue;
    result[field] = picked(item, subtree);
  }
  return result;
}

// Case, accents and punctuation don't matter to IGDB's search: "stalker" finds "STALKER: Shadow
// of Chernobyl".
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

// What the fake reads of an Apicalypse query: the clauses it holds, each ended by a semicolon.
interface Query {
  search: string | null;
  fields: string[];
  where: string | null;
  limit: number;
}

function parse(body: string): Query | null {
  const clauses = new Map<string, string>();
  const clause = /\s*(search|fields|where|limit)\s+((?:"(?:[^"\\]|\\.)*"|[^;"])*);/y;
  let end = 0;
  for (let match = clause.exec(body); match; match = clause.exec(body)) {
    clauses.set(match[1] ?? "", (match[2] ?? "").trim());
    end = clause.lastIndex;
  }
  if (body.slice(end).trim() || !clauses.has("fields")) return null;
  const search = clauses.get("search");
  const searched = search && /^"((?:[^"\\]|\\.)*)"$/.exec(search)?.[1];
  if (search !== undefined && !searched) return null;
  return {
    search: searched ? searched.replace(/\\(.)/g, "$1") : null,
    fields: (clauses.get("fields") ?? "").split(",").map((field) => field.trim()),
    where: clauses.get("where") ?? null,
    limit: Number(clauses.get("limit") ?? 10),
  };
}

// The games a `where` clause keeps. The fake knows the clauses the Worker sends, joined by `&`,
// and answers any other with null, which IGDB would read differently.
function kept(where: string | null): ((game: FakeGame) => boolean) | null {
  if (where === null) return () => true;
  const tests: ((game: FakeGame) => boolean)[] = [];
  for (const condition of where.split(/\s*&\s*(?![^()]*\))/)) {
    const id = /^id = (\d+)$/.exec(condition)?.[1];
    const types = /^game_type = \(([\d,]+)\)$/.exec(condition)?.[1];
    if (id) tests.push((game) => game.id === Number(id));
    else if (types) tests.push((game) => types.split(",").map(Number).includes(game.gameType));
    else if (condition === "version_parent = null") {
      tests.push((game) => game.versionParent === undefined);
    } else if (condition === "(game_status = null | game_status != 6)") {
      tests.push((game) => game.gameStatus !== 6);
    } else return null;
  }
  return (game) => tests.every((test) => test(game));
}

// The access tokens the fake has granted, and the time before which it refuses them all, as
// Twitch does once a token is revoked. A token carries when it was granted, so one the Worker
// stored in local D1 before the fake restarted still works.
let granted = 0;
let refusedBefore = 0;

const tokenPattern = /^fake-igdb-token-(\d+)-\d+$/;

// A token the fake takes, granted now, for a test to store as the Worker's own.
export function igdbFakeToken(): string {
  return `fake-igdb-token-${Math.max(Date.now(), refusedBefore)}-0`;
}

function accepted(authorization: string | undefined): boolean {
  const grantedAt = tokenPattern.exec(authorization?.replace(/^Bearer /, "") ?? "")?.[1];
  return grantedAt !== undefined && Number(grantedAt) >= refusedBefore;
}

// For the test hooks: how many tokens the fake has granted, and refusing every token granted so
// far, as when Twitch revokes them, so the Worker's next request to IGDB gets a 401.
export const igdbFakeTokens = {
  granted: () => granted,
  refuseAll: () => {
    refusedBefore = Date.now() + 1;
  },
};

export const igdbFake = new Hono();

// Twitch's client credentials grant, which takes the application's ID and secret as a form.
igdbFake.post("/oauth2/token", async (c) => {
  const form = new URLSearchParams(await c.req.text());
  if (form.get("grant_type") !== "client_credentials") {
    return c.json({ status: 400, message: "unsupported grant type" }, 400);
  }
  if (!form.get("client_id")) return c.json({ status: 400, message: "missing client id" }, 400);
  if (!form.get("client_secret")) {
    return c.json({ status: 403, message: "invalid client secret" }, 403);
  }
  granted += 1;
  // A grant in the same millisecond as a refusal would be refused.
  const grantedAt = Math.max(Date.now(), refusedBefore);
  return c.json({
    access_token: `fake-igdb-token-${grantedAt}-${granted}`,
    expires_in: 5_184_000,
    token_type: "bearer",
  });
});

igdbFake.post("/v4/games", async (c) => {
  if (!c.req.header("Client-ID") || !accepted(c.req.header("Authorization"))) {
    return c.json({ message: "Authorization Failure. Have you tried:", Tip: "" }, 401);
  }
  const query = parse(await c.req.text());
  const keep = query && kept(query.where);
  if (!query || !keep) {
    return c.json([{ title: "Syntax Error", status: 400, cause: "The fake can't read this" }], 400);
  }
  if (query.search === failingQuery) return c.text("Service Unavailable", 503);
  const newGameId = query.search && newGameQuery.exec(query.search)?.[1];
  let found: FakeGame[];
  if (newGameId) {
    found = [newGame(Number(newGameId))];
  } else if (query.search !== null) {
    const words = fold(query.search);
    found = words
      ? games.filter((game) => {
          return [game.name, ...(game.alternativeNames ?? [])].some((name) => {
            return fold(name).includes(words);
          });
        })
      : [];
  } else {
    found = games;
  }
  if (query.where === `id = ${detailsFailureId}`) return c.text("Internal Server Error", 500);
  found = found.filter(keep);
  const tree = fieldTree(query.fields);
  return c.json(found.slice(0, query.limit).map((game) => picked(record(game), tree)));
});

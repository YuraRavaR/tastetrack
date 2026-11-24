// The artists of the MusicBrainz fake (./musicbrainz-fake.ts), which answers their search, their
// lookups and their albums lists from here. They mirror MusicBrainz's answers of 2026-11-24, cut to
// what the Worker reads, so the same tests pass here and against MusicBrainz on staging. Their
// Wikidata IDs are the real ones, which the Wikimedia fake (./wikimedia-fake.ts) answers for. An
// artist whose photo the fake doesn't hold has no Wikidata link here.

interface FakeArtist {
  id: string;
  name: string;
  sortName?: string;
  type?: string;
  // The country code of a lookup. A search row has one only where the area is a country, which
  // `rowCountry: false` says it isn't, as Pink Floyd's England.
  country?: string;
  rowCountry?: false;
  begin?: string;
  end?: string;
  ended?: boolean;
  disambiguation?: string;
  aliases?: string[];
  wikidata?: string;
  // Their official studio Albums and EPs, as the albums-list search answers them, in its order:
  // [release-group MBID, title, first-release date, primary type, secondary types].
  albums?: [string, string, string, string, string[]?][];
}

// In the order MusicBrainz's search ranks them for every query the tests send.
const artists: FakeArtist[] = [
  // Found in Cyrillic and by its Latin aliases and sort name.
  {
    id: "87a417d3-f118-43e0-bece-3de1bd90fce0",
    name: "Океан Ельзи",
    sortName: "Okean Elzy",
    type: "Group",
    country: "UA",
    begin: "1994-10-12",
    aliases: ["Океан Эльзы", "Okean Elsi", "Okean Elzi", "Okean Elzy", "ОЕ"],
    wikidata: "Q1008489",
    albums: [
      ["086ad18e-9e88-4869-b361-cf5e832e5c22", "Dolce Vita", "2010-03-10", "Album"],
      ["a887b784-8dbc-3094-b9b0-e924af50e0b4", "Модель", "2001-04-20", "Album"],
      ["be150046-3587-3e47-9d18-a6d89fb61d51", "Міра", "2007-04-25", "Album"],
      ["080f0c63-6e0b-42d0-917d-e22d1d4bdaf8", "Земля", "2013-05-15", "Album"],
      ["a39a1436-498a-36ef-8c7b-780eac439b07", "Суперсиметрія", "2003-03-12", "Album"],
      ["9a94fc90-68a4-4dc8-a063-3b83517ef7fc", "Той день", "2024-09-20", "Album"],
      ["1a83bef9-cb9d-491b-bc9d-f9a696204c7d", "Без меж", "2016-05-18", "Album"],
      ["66785e5c-8806-4f08-b7c5-30797af49ead", "Lighthouse", "2024-10-11", "Album"],
      ["09973323-973e-3b4c-af61-a579f2c201d0", "Там, де нас нема", "1998-09-14", "Album"],
      ["c6426fc3-8f24-481b-aa69-6ad27326b378", "Янанебібув", "2000-02-21", "Album"],
      ["573c612a-4599-379f-a3f8-c365aec20bcd", "GLORIA", "2005-09-22", "Album"],
    ],
  },
  // KALUSH before Kalush Orchestra for "Kalush"; "Kalush Orchestra" finds only the second.
  {
    id: "628d9735-f961-4eb0-92ee-31d77f9c8b8f",
    name: "KALUSH",
    type: "Group",
    country: "UA",
    begin: "2019",
  },
  {
    id: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25",
    name: "Kalush Orchestra",
    type: "Group",
    country: "UA",
    begin: "2021",
    wikidata: "Q80808767",
    albums: [["e715b41e-d879-4c25-aeed-3962ca2a0425", "Stefania", "2022-05-20", "EP"]],
  },
  {
    id: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
    name: "Radiohead",
    type: "Group",
    country: "GB",
    begin: "1991",
    aliases: ["r/head", "Radio Head"],
    wikidata: "Q44190",
    albums: [
      ["b2246643-115e-3b53-9a96-6d2df930f970", "Drill", "1992-05-05", "EP"],
      ["30eb21a4-b9df-435f-b779-590617fe9b44", "In Rainbows Disk 2", "2009-06-09", "EP"],
      ["6972f148-6bd0-4cbe-8733-36bf24a3e19e", "Anyone Can Play Guitar", "1994-06-06", "EP"],
      ["63b2aeb3-146b-343e-bbb5-0317c8a1e328", "Itch", "1994-06-01", "EP"],
      [
        "1626bbb8-05bd-3621-a0c7-9278e3b79dca",
        "No Surprises / Running From Demons",
        "1997-12-10",
        "EP",
      ],
      ["471b4ff5-004f-4a7b-b0ba-a0837c41da14", "Creep", "1992-09-21", "EP"],
      ["99445a2b-578a-321e-851e-c6539bfbbd7f", "My Iron Lung", "1994-09-24", "EP"],
      ["7b39ccb5-b49c-37e1-80ec-5ac0b2a89fe4", "Airbag / How Am I Driving?", "1998-04-21", "EP"],
      ["b8048f24-c026-3398-b23a-b5e50716cbc7", "The Bends", "1994-11-29", "Album"],
      ["bca9280e-28b4-327f-8fe0-fd918579e486", "Amnesiac", "2001-05-30", "Album"],
      ["cd76f76b-ff15-3784-a71d-4da3078a6851", "Pablo Honey", "1993-02-22", "Album"],
      ["bbce0087-d386-4246-a51d-dbcdfdbe8fb2", "A Moon Shaped Pool", "2016-05-08", "Album"],
      ["6e335887-60ba-38f0-95af-fae7774336bf", "In Rainbows", "2007-10-10", "Album"],
      ["b1392450-e666-3926-a536-22c65f834433", "OK Computer", "1997-05-21", "Album"],
      ["899b6d09-807e-4c18-a6d4-3642e00d6a3d", "The King of Limbs", "2011-02-18", "Album"],
      ["e75c0549-ad55-39e3-8025-c72c5d4a3c5d", "Kid A", "2000-08-03", "Album"],
      ["5c14fd50-a2f1-3672-9537-b0dad91bea2f", "Hail to the Thief", "2003-05-26", "Album"],
    ],
  },
  // A solo artist and a group of one name, the singer first. The fake's Wikidata fails for the
  // singer, as Wikimedia does when it is down.
  {
    id: "ee58c59f-8e7f-4430-b8ca-236c4d3745ae",
    name: "Alice Cooper",
    sortName: "Cooper, Alice",
    type: "Person",
    country: "US",
    begin: "1948-02-04",
    disambiguation: "the singer, active as a solo artist 1975–present",
    wikidata: "Q332032",
  },
  {
    id: "4d7928cd-7ed2-4282-8c29-c0c9f966f1bd",
    name: "Alice Cooper",
    type: "Group",
    country: "US",
    begin: "1964",
    end: "1975",
    ended: true,
    disambiguation: "the band, active 1964–1974/5",
  },
  // An ended group, whose area is England: its search row has no country, its lookup GB. Its
  // albums list has soundtracks among its studio albums, and an EP dated by its year alone.
  {
    id: "83d91898-7763-47d7-b03b-b92132375c47",
    name: "Pink Floyd",
    type: "Group",
    country: "GB",
    rowCountry: false,
    begin: "1965",
    end: "2014",
    ended: true,
    wikidata: "Q2306",
    albums: [
      ["8cfe1674-1fd4-45d4-ad2d-b30951d07a59", "1965: Their First Recordings", "2015-11-27", "EP"],
      ["981911ba-b43a-312a-a1b7-afb819a3d223", "London 1966/1967", "1995", "EP"],
      [
        "1ac6af64-25af-3ccb-a913-a7890ae8035c",
        "Tonite Let’s All Make Love in London… Plus",
        "1991",
        "EP",
        ["Soundtrack"],
      ],
      ["cb3bae49-d624-4dd9-b0a4-b4dfc4f3cefa", "The Final Cut: Video EP", "1983", "EP"],
      ["90878b63-f639-3c8b-aefb-190bdf3d1790", "The Division Bell", "1994-03-28", "Album"],
      ["38b4c840-16ce-40fa-b7c0-a354b7c87178", "The Endless River", "2014-11-07", "Album"],
      ["8a9caa40-b7c6-33eb-a13c-6c15f09b1c44", "A Saucerful of Secrets", "1968-06-29", "Album"],
      ["b7aa61ae-3572-32c0-8b93-6af78ea83760", "Ummagumma", "1969-10-25", "Album"],
      ["4e98c9b4-92f6-3049-b9da-a1088b623672", "Meddle", "1971-10-30", "Album"],
      ["43d42d00-46fb-3d9c-9612-03d30fb20307", "More", "1969-06-13", "Album", ["Soundtrack"]],
      ["e2f503d7-5488-3fe1-b3ac-f236d9f1b44c", "Atom Heart Mother", "1970-10-10", "Album"],
      [
        "6792b6d1-4e65-3c3c-9d20-d08aa1dcfc60",
        "The Piper at the Gates of Dawn",
        "1967-07-07",
        "Album",
      ],
      [
        "4940b8aa-898b-3e60-9992-94e073bab6f6",
        "A Momentary Lapse of Reason",
        "1987-09-07",
        "Album",
      ],
      ["e8b7e7a3-ef56-34a5-bedf-085783c9a076", "The Final Cut", "1983-03-21", "Album"],
      [
        "a6f0826e-9b27-3d75-b30c-e5d33235777a",
        "Obscured by Clouds",
        "1972-06-03",
        "Album",
        ["Soundtrack"],
      ],
      ["f5093c06-23e3-404f-aeaa-40f72885ee3a", "The Dark Side of the Moon", "1973-03-24", "Album"],
      ["f2026101-945b-3d05-9ef4-aa718fc3feef", "The Wall", "1979-11-30", "Album"],
      ["20c77fb4-1c9f-33c8-9d7e-c4977f11e847", "Animals", "1977-01-23", "Album"],
      ["1a272023-10d3-38ee-bab3-317b55fcc21d", "Wish You Were Here", "1975-09-12", "Album"],
    ],
  },
  // A tribute band with no Wikidata link and no begin date.
  {
    id: "b32609b0-d91e-4227-a7c5-998facfe8741",
    name: "Celtic Pink Floyd",
    type: "Group",
    country: "US",
  },
  // Ended, with no end date.
  {
    id: "0383dadf-2a4e-4d10-a46a-e9e041da8eb3",
    name: "Queen",
    type: "Group",
    country: "GB",
    begin: "1970-06-27",
    ended: true,
    disambiguation: "UK rock group",
  },
  // The 1960s UK Nirvana, whose Wikidata entity has no image.
  {
    id: "9282c8b4-ca0b-4c6b-b7e3-4f7762dfc4d6",
    name: "Nirvana",
    type: "Group",
    country: "GB",
    begin: "1967",
    disambiguation: "60s band from the UK",
    wikidata: "Q1855965",
  },
  // The special-purpose Various Artists first, then two real artists of that name.
  {
    id: "89ad4ac3-39f7-470e-963a-56509c546377",
    name: "Various Artists",
    type: "Other",
    disambiguation: "add compilations to this artist",
  },
  {
    id: "4e46dd54-81a6-4a75-a666-d0e447861e3f",
    name: "Various Artists",
    type: "Person",
    country: "DE",
    disambiguation: "German techno producer Torsten Pröfrock, DO NOT add compilations",
  },
  {
    id: "8e107957-c443-45b4-84f7-8b054499ef78",
    name: "Various Artists",
    type: "Group",
    disambiguation: "UK band from Bristol",
  },
  // A special-purpose artist.
  {
    id: "125ec42a-7229-4250-afc5-e057484327fe",
    name: "[unknown]",
    type: "Other",
    country: "XW",
    disambiguation: "Special Purpose Artist – Do not add releases here, if possible.",
  },
  // The artist a merged one became.
  {
    id: "24dad84a-2918-48aa-9337-07b675443f0d",
    name: "Taylor Dee",
    sortName: "Dee, Taylor",
    type: "Person",
    country: "US",
    begin: "1987-07-16",
    end: "2021-03-14",
    ended: true,
    disambiguation: "country singer Taylor Dawn Carroll",
  },
];

// Old MBIDs of merged artists, and the one each became, as MusicBrainz answered on 2026-11-24.
export const mergedArtists = new Map([
  ["e3329ebf-a7ee-45a0-98d5-c84a482a4611", "24dad84a-2918-48aa-9337-07b675443f0d"],
]);

// The words of a text as the fake matches them: lowercased, without accents, split at anything
// but letters and digits.
function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function lifeSpanOf(artist: FakeArtist, lookup: boolean) {
  return lookup
    ? { begin: artist.begin ?? null, end: artist.end ?? null, ended: artist.ended ?? false }
    : {
        ...(artist.begin && { begin: artist.begin }),
        ...(artist.end && { end: artist.end }),
        ended: artist.ended ?? null,
      };
}

// An artist as a search row: what it has none of left out, the country only where the area is one.
function searchRow(artist: FakeArtist) {
  return {
    id: artist.id,
    ...(artist.type && { type: artist.type }),
    score: 100,
    name: artist.name,
    "sort-name": artist.sortName ?? artist.name,
    ...(artist.country && artist.rowCountry !== false && { country: artist.country }),
    "life-span": lifeSpanOf(artist, false),
    ...(artist.disambiguation && { disambiguation: artist.disambiguation }),
    aliases: (artist.aliases ?? []).map((name) => ({ name, "sort-name": name })),
  };
}

// An artist as a lookup with URL relations answers: an empty disambiguation, and the Wikidata link
// among the relations.
function lookupResult(artist: FakeArtist) {
  return {
    id: artist.id,
    type: artist.type ?? null,
    name: artist.name,
    "sort-name": artist.sortName ?? artist.name,
    country: artist.country ?? null,
    "life-span": lifeSpanOf(artist, true),
    disambiguation: artist.disambiguation ?? "",
    relations: artist.wikidata
      ? [
          {
            type: "wikidata",
            "target-type": "url",
            url: { resource: `https://www.wikidata.org/wiki/${artist.wikidata}` },
          },
        ]
      : [],
  };
}

// An artist search of the shape the Worker sends, `w1 AND … AND wn`: the artists whose name, sort
// name, aliases or disambiguation hold every word, in the fake's order.
export function artistSearch(query: string, limit: number) {
  const words = query.split(" AND ").map((word) => tokensOf(word.replace(/\\(.)/g, "$1")));
  const found = artists.filter((artist) => {
    const text = [artist.name, artist.sortName, artist.disambiguation, ...(artist.aliases ?? [])];
    const tokens = new Set(tokensOf(text.join(" ")));
    return words.every((word) => word.length > 0 && word.every((token) => tokens.has(token)));
  });
  return {
    created: "2026-11-24T20:47:01.344Z",
    count: found.length,
    offset: 0,
    artists: found.slice(0, limit).map(searchRow),
  };
}

// The lookup of an artist the fake has, or null.
export function artistLookup(id: string) {
  const artist = artists.find((each) => each.id === id);
  return artist ? lookupResult(artist) : null;
}

// An albums-list search of the shape the Worker sends, `arid:<mbid> AND …`: the artist's official
// studio Albums and EPs, or none for an artist the fake has none of. Null for any other query.
export function artistAlbumsSearch(query: string, limit: number) {
  const artistId = /^arid:(\S+) AND /.exec(query)?.[1];
  if (!artistId) return null;
  const albums = artists.find((artist) => artist.id === artistId)?.albums ?? [];
  return {
    created: "2026-11-24T20:47:01.344Z",
    count: albums.length,
    offset: 0,
    "release-groups": albums
      .slice(0, limit)
      .map(([id, title, date, primaryType, secondaryTypes]) => ({
        id,
        score: 100,
        title,
        "first-release-date": date,
        "primary-type": primaryType,
        ...(secondaryTypes && { "secondary-types": secondaryTypes }),
      })),
  };
}

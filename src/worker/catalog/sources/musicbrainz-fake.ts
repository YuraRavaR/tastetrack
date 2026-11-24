// A MusicBrainz fake with fixed data, and a Cover Art Archive fake beside it, mounted among the
// test hooks so that the `local` Worker calls them instead of the real ones (wrangler.jsonc). Like
// MusicBrainz it reads a release-group search's Lucene query, with the type filter inside it, and a
// recording search's, with the hiding inside it, and looks a release group or a recording up by
// MBID, answering a merged one's old MBID with a 301. Its release groups mirror real MusicBrainz
// data (checked 2026-11-21), and its recordings real answers of the recording search check
// (2026-11-22), so the same tests pass here and against MusicBrainz on staging. Its artists, their
// lookups and their albums lists are in ./musicbrainz-artists-fake.ts.
//
// It enforces MusicBrainz's rate limit: a call sooner than MUSICBRAINZ_INTERVAL_MS after the one
// before gets a 503, as the real one answers, so a test sees a call the Worker didn't pace. A test
// browser's song searches come under /browser/<id>/, each limited on its own at about the
// browser's interval. Under /busy/<times>/<id>/ it answers 503 to the first <times> calls with that
// <id> too, which is how a test asks for MusicBrainz busy (X-Test-MusicBrainz-Busy for the
// Worker's calls), without another test's calls taking its 503s.
import { type Context, Hono } from "hono";
import {
  artistAlbumsSearch,
  artistLookup,
  artistSearch,
  mergedArtists,
} from "./musicbrainz-artists-fake";

interface FakeCredit {
  name: string;
  joinphrase?: string;
  artistId: string;
}

interface FakeReleaseGroup {
  id: string;
  title: string;
  primaryType: "Album" | "EP" | "Single" | "Other" | null;
  secondaryTypes?: string[];
  firstReleaseDate?: string;
  credits: FakeCredit[];
  // How many releases it has, as MusicBrainz counts them.
  releases: number;
  // Whether the Cover Art Archive has a front cover for it.
  cover: boolean;
  // Its Wikidata and Discogs pages, of the URL relations MusicBrainz has.
  relations?: string[];
}

const beatles = { name: "The Beatles", artistId: "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d" };
const jamala = { name: "Jamala", artistId: "3d264dc4-b1f2-409f-8ab4-3d17d8b42b02" };

// In the order MusicBrainz's search ranks them, which the Worker reranks.
const releaseGroups: FakeReleaseGroup[] = [
  // An album of six releases, titled in Cyrillic, with no aliases.
  {
    id: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
    title: "Земля",
    primaryType: "Album",
    firstReleaseDate: "2013-05-15",
    credits: [{ name: "Океан Ельзи", artistId: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
    releases: 6,
    cover: true,
    relations: ["https://www.discogs.com/master/593968", "https://www.wikidata.org/wiki/Q14633569"],
  },
  // An EP of the same title by another artist.
  {
    id: "c70b84d2-1538-44c5-a7f0-71ed32508e92",
    title: "Земля",
    primaryType: "EP",
    firstReleaseDate: "2022-11-22",
    credits: [{ name: "Анна Ворфоломеева", artistId: "3b6f354a-c766-4147-8f25-6d13d6be9e1b" }],
    releases: 1,
    cover: true,
  },
  // Abbey Road, with its remix album, which has no cover, and among them albums of other artists
  // that share its title and a single.
  {
    id: "c0b2899c-41ab-4907-abf0-ff1962477ff2",
    title: "Abbey's Road",
    primaryType: "Album",
    firstReleaseDate: "2016",
    credits: [
      {
        name: "Ada Montellanico",
        joinphrase: " feat. ",
        artistId: "1aa00b34-ccfc-468d-aa4c-425e1b8eb7f8",
      },
      { name: "Giovanni Falzone", artistId: "e3fe8224-eb5f-4411-a922-26da0ebdc912" },
    ],
    releases: 2,
    cover: true,
  },
  {
    id: "284326a7-edbb-4b9b-82cf-dc53863759ef",
    title: "Abbey Road",
    primaryType: "Single",
    firstReleaseDate: "2026-01-02",
    credits: [{ name: "Diana Herrera", artistId: "b1609980-fe3c-45fa-8892-03f2f4864e4a" }],
    releases: 1,
    cover: true,
  },
  {
    id: "004a4e79-ac6c-448a-9d7f-b1b1714aa22a",
    title: "Abbey Road",
    primaryType: "Album",
    firstReleaseDate: "2012-08-14",
    credits: [{ name: "Various Artists", artistId: "89ad4ac3-39f7-470e-963a-56509c546377" }],
    releases: 1,
    cover: true,
  },
  {
    id: "42ef6001-3113-440c-ae7c-3667c7351e35",
    title: "Abbey Road Remix",
    primaryType: "Album",
    secondaryTypes: ["Remix"],
    firstReleaseDate: "2012",
    credits: [beatles],
    releases: 1,
    cover: false,
  },
  {
    id: "9162580e-5df4-32de-80cc-f45a8d8a9b1d",
    title: "Abbey Road",
    primaryType: "Album",
    firstReleaseDate: "1969-09-26",
    credits: [beatles],
    releases: 75,
    cover: true,
    relations: ["https://www.discogs.com/master/24047", "https://www.wikidata.org/wiki/Q173643"],
  },
  // A live album.
  {
    id: "eabb68b3-d57c-359a-8215-91f38d365da5",
    title: "The Beatles at the Hollywood Bowl",
    primaryType: "Album",
    secondaryTypes: ["Live"],
    firstReleaseDate: "1977-05-04",
    credits: [beatles],
    releases: 12,
    cover: true,
  },
  // An interview, which search hides though its primary type is Album, and one whose is Other.
  {
    id: "84225cac-5cd3-3389-a84e-e673e3bf3242",
    title: "The Beatles’ Story",
    primaryType: "Album",
    secondaryTypes: ["Interview"],
    firstReleaseDate: "1964-11-23",
    credits: [beatles],
    releases: 17,
    cover: true,
  },
  {
    id: "1068b40b-4a1f-3208-b009-42bf88fac2b9",
    title: "Interview Disc",
    primaryType: "Other",
    secondaryTypes: ["Interview"],
    firstReleaseDate: "1992",
    credits: [beatles],
    releases: 2,
    cover: false,
  },
  // 1944: MusicBrainz puts the EP first, then the album, then the single, all by Jamala, and EPs
  // and an album of that title by others.
  {
    id: "b7f51377-4088-43bc-beb7-58705d9af90e",
    title: "1944",
    primaryType: "EP",
    firstReleaseDate: "2016-05-07",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "68b61f05-aa49-4dda-9cdc-1104e4541aed",
    title: "1944",
    primaryType: "Album",
    firstReleaseDate: "2016-06-10",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "04d4b9ba-6f72-4c52-b907-8536ff96f304",
    title: "1944",
    primaryType: "Single",
    firstReleaseDate: "2016-02-12",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "d9e73c6c-2fd9-4652-b1b1-87031957d705",
    title: "1944",
    primaryType: "EP",
    secondaryTypes: ["Mixtape/Street"],
    firstReleaseDate: "2023-12-17",
    credits: [{ name: "À TERRE", artistId: "9b55410b-9e2e-490d-b803-09a4b0bdf66f" }],
    releases: 1,
    cover: true,
  },
  // A soundtrack.
  {
    id: "4513c7b9-854e-457f-81d6-3dbeb001beb8",
    title: "Interstellar: Original Motion Picture Soundtrack",
    primaryType: "Album",
    secondaryTypes: ["Soundtrack"],
    firstReleaseDate: "2014-11-17",
    credits: [{ name: "Hans Zimmer", artistId: "e6de1f3b-6484-491c-88dd-6d619f142abc" }],
    releases: 19,
    cover: true,
  },
  // An audiobook, which search hides though its primary type is Album, with no release date.
  {
    id: "a9e84258-d41b-4c64-84e3-654e71eb8154",
    title: "Troy: The Siege of Troy Retold",
    primaryType: "Album",
    secondaryTypes: ["Audiobook"],
    credits: [{ name: "Stephen Fry", artistId: "fad46635-5d90-484e-bcf9-5a8e3c1f8830" }],
    releases: 1,
    cover: true,
  },
  {
    id: "54dc9f4b-ed57-4ac7-9829-9df51ce2f78c",
    title: "TROY",
    primaryType: "EP",
    firstReleaseDate: "2015-07-10",
    credits: [{ name: "Jaime Woods", artistId: "1e10de66-d854-4091-b647-15bc86742f01" }],
    releases: 1,
    cover: true,
  },
  // Two credited artists, joined as MusicBrainz shows them, and no cover.
  {
    id: "67210625-2acc-4689-8b76-a43181af8a10",
    title: "The Bedouin Reworks Of Dakhabrakha",
    primaryType: "EP",
    firstReleaseDate: "2022-03-30",
    credits: [
      { name: "Bedouin", joinphrase: ", ", artistId: "c9b34ac9-83ab-44f4-8358-348d8ea8d6c2" },
      { name: "DakhaBrakha", artistId: "208334a1-abf0-4791-9705-b45838244b29" },
    ],
    releases: 1,
    cover: false,
  },
  // The Dark Side of the Moon, which MusicBrainz ranks behind two tributes that name it in their
  // titles, one of them a plain studio album.
  {
    id: "b4ad465f-6abf-4496-a881-c6764732c8a4",
    title: "A Tribute to Pink Floyd’s Dark Side of the Moon",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
    firstReleaseDate: "2003",
    credits: [{ name: "E.S.P", artistId: "6140e50b-09c7-46af-89e5-801e816ab813" }],
    releases: 1,
    cover: true,
  },
  {
    id: "6d3d6885-651b-3d8e-a67b-7832248abb52",
    title: "The String Quartet Tribute to Pink Floyd’s The Dark Side of the Moon",
    primaryType: "Album",
    firstReleaseDate: "2003-04-29",
    credits: [
      {
        name: "Vitamin String Quartet",
        joinphrase: " feat. ",
        artistId: "56cfe6aa-b464-43d2-bec7-8ec52f313e7d",
      },
      { name: "The Section", artistId: "2b5929bc-ffbf-496b-a66f-90dae13cbfe7" },
    ],
    releases: 2,
    cover: true,
  },
  {
    id: "f5093c06-23e3-404f-aeaa-40f72885ee3a",
    title: "The Dark Side of the Moon",
    primaryType: "Album",
    firstReleaseDate: "1973-03-24",
    credits: [{ name: "Pink Floyd", artistId: "83d91898-7763-47d7-b03b-b92132375c47" }],
    releases: 152,
    cover: true,
  },
  // MTV Unplugged in New York, a live album, which MusicBrainz ranks first, then a plain studio
  // album of covers of its songs, and another artist's live album of the same title.
  {
    id: "fb3770f6-83fb-32b7-85c4-1f522a92287e",
    title: "MTV Unplugged in New York",
    primaryType: "Album",
    secondaryTypes: ["Live"],
    firstReleaseDate: "1994-10-31",
    credits: [{ name: "Nirvana", artistId: "5b11f4ce-a62d-471e-81fc-a69a8278c7da" }],
    releases: 46,
    cover: true,
  },
  {
    id: "9be783c7-57c1-4555-ab44-188b569bae04",
    title: "A Tribute to Nirvana, The Songs of MTV Unplugged in New York",
    primaryType: "Album",
    firstReleaseDate: "2025-02-07",
    credits: [{ name: "Various Artists", artistId: "89ad4ac3-39f7-470e-963a-56509c546377" }],
    releases: 1,
    cover: true,
  },
  {
    id: "f81f334b-69d6-3fc1-87d3-d4d7d19d9cc5",
    title: "MTV Unplugged in New York",
    primaryType: "Album",
    secondaryTypes: ["Live"],
    firstReleaseDate: "2009-05-22",
    credits: [{ name: "Sportfreunde Stiller", artistId: "35581de7-591f-424f-9c64-7b22fd45605e" }],
    releases: 4,
    cover: true,
  },
  // The release group a merged one became.
  {
    id: "9cd2811d-a999-326e-8945-a8b6b44b9e92",
    title: "Bye Bye Birdie",
    primaryType: "Album",
    secondaryTypes: ["Soundtrack"],
    firstReleaseDate: "1963",
    credits: [{ name: "Charles Strouse", artistId: "52eb3f6f-9601-4690-a336-536688082652" }],
    releases: 9,
    cover: true,
  },
];

// A release group a recording is on, as a recording's search result or lookup gives it.
interface FakeRecordingGroup {
  title: string;
  primaryType: string | null;
  secondaryTypes?: string[];
}

// A recording, with its releases as [release MBID, status, date, release-group MBID].
interface FakeRecording {
  id: string;
  title: string;
  credits: FakeCredit[];
  disambiguation?: string;
  video?: boolean;
  firstReleaseDate?: string;
  releases: [string, string | null, string | null, string][];
}

// The release groups the recordings are on, by MBID.
const recordingGroups: Record<string, FakeRecordingGroup> = {
  "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8": { title: "Земля", primaryType: "Album" },
  "4be03245-0fce-49fa-8f16-f52d14d6e5ca": {
    title: "Избранное",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "4fd056c1-3439-4b4a-a923-294ac66cfd3e": {
    title: "Найкраще",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "5de21cba-b851-4960-a859-4a6a88060a1d": { title: "Обійми", primaryType: "Single" },
  "1a83bef9-cb9d-491b-bc9d-f9a696204c7d": { title: "Без меж", primaryType: "Album" },
  "50fbd197-b456-4368-a491-d69ddd43ddae": {
    title: "Обійми (Yaroslav Tretiak Remix)",
    primaryType: "Single",
    secondaryTypes: ["Remix"],
  },
  "44965ed2-80bb-4787-9996-84c5d3937870": { title: "Шум", primaryType: "Single" },
  "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47": {
    title: "Eurovision Song Contest: Turin 2022",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "3c507fbe-6ed2-4885-926a-7998a70644d0": {
    title: "Bravo Hits 117",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "94f8aba6-96cf-4dbc-9aec-27348b39c7b6": {
    title: "Now That’s What I Call Eurovision Song Contest",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "91a87b8c-d46c-4b8a-ac8d-543ea5617cff": {
    title: "Absolute Music 91",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "0301f8a7-f3c8-40cb-a405-845fc01eecc4": {
    title: "Now That’s What I Call Music! 112",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "e715b41e-d879-4c25-aeed-3962ca2a0425": { title: "Stefania", primaryType: "EP" },
  "56f1d0cf-adf5-4d83-a700-6dbe2232a6d8": { title: "Stefania", primaryType: "Single" },
  "a9f0b088-ea8b-460c-9cc4-8516d841f544": {
    title: "The Sound of a Remix: The Eurovision 2022 Song Contest",
    primaryType: "Other",
    secondaryTypes: ["Compilation", "Remix"],
  },
  "441803f3-eb4d-3847-93cf-ab473cf0b8ec": {
    title: "1997-06-28: Glastonbury Festival of Contemporary Performing Arts",
    primaryType: "Album",
    secondaryTypes: ["Live"],
  },
  "a6719e42-eacc-3532-8d63-97cfc0cdcd41": {
    title: "Glastonbury Anthems: The Best of Glastonbury 1994-2004",
    primaryType: "Album",
    secondaryTypes: ["Compilation", "Live"],
  },
  "db8199af-bf6b-4c37-a8ea-0d60c5ef6aca": {
    title: "Le Meilleux Mix 97",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "d8758f15-65c9-3f34-baf9-475b30755e2b": { title: "Karma Police", primaryType: "Single" },
  "c07c5ecb-0ec5-4cd0-8ae0-b8c4e28156b6": {
    title: "Philia - Artists Rise Against Islamophobia",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "e449d0a3-5661-338c-a51e-a9910f725fa5": {
    title: "Towering Above the Rest",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "b77895f1-343b-4a15-bef4-7951ff460214": {
    title: "The Youtube Covers of 2007",
    primaryType: "Album",
  },
  "b1392450-e666-3926-a536-22c65f834433": { title: "OK Computer", primaryType: "Album" },
  "cc6e687b-8e34-4ec4-8b8c-ad7740f7a9e6": {
    title: "Hit Explosion ’97, Volume 9",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "26c77d0d-6361-3b85-ace9-70b476e53b25": {
    title: "Now That’s What I Call Music! 38",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "6ac62eec-209a-44e3-b060-32c35d424d37": {
    title: "Attitude",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "53f59e5b-adc9-4c36-a724-cf3aeab69b38": {
    title: "Computer K.O.",
    primaryType: "Album",
    secondaryTypes: ["Live"],
  },
  "dcc1a8fa-8d03-4012-a830-dbe74cabd2e1": {
    title: "Kiss FM Hits 5",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "035848e3-a486-4066-a18b-97a8b57bdb98": {
    title: "Mr Music Hits 11. 1997",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "46278b1b-47fd-4655-ba14-2eac2a310808": {
    title: "Running Up That Hill (A Deal With God) (2012 remix)",
    primaryType: "Single",
    secondaryTypes: ["Remix"],
  },
  "93178ae7-7d14-4aec-af12-efb5633f6968": {
    title:
      "A Symphony of British Music: Music for the Closing Ceremony of the London 2012 Olympic Games",
    primaryType: "Album",
    secondaryTypes: ["Soundtrack"],
  },
  "0fde4f98-ae21-4390-916c-064551e5d464": {
    title: "Café del Mar, Volumen Diecinueve",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "af71236e-1c04-431b-a53d-909b72ba9f2b": {
    title: "The Other Sides",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "1b7b587e-53f3-410e-af9f-c816dd3b4ed0": {
    title: "Remastered, Part II",
    primaryType: "Album",
    secondaryTypes: ["Compilation"],
  },
  "eb86960f-7902-4971-9ad1-cb4d2a332501": {
    title: "Selection from ‘The Other Sides’",
    primaryType: "EP",
    secondaryTypes: ["Compilation"],
  },
};

// In the order MusicBrainz's search ranks them without the query's boosts, which the fake ignores:
// Обійми, with its bonus-track and remix recordings; Шум, with its original version, its radio
// edit and two videos on no release; Stefania, with a karaoke version and a remix on no Official
// release; Karma Police, behind a live bootleg, a live video, another Radiohead recording on one
// compilation, a live cover on no release, the single's own recording, three covers, one of them
// on an album the Cover Art Archive has no cover for, and Radiohead with Michael Stipe. Its studio
// recording holds the 25 releases a lookup gives, of its 151. Last, the recording a merged one
// became.
const recordings: FakeRecording[] = [
  {
    id: "d8d55f18-0c4b-4036-a16d-e273ac8953fc",
    title: "Обійми",
    credits: [{ name: "Океан Ельзи", artistId: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
    firstReleaseDate: "2013-02-14",
    releases: [
      [
        "5ec4f47f-9d7c-4469-82ba-4d5982a6de74",
        "Official",
        "2013-05-15",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
      [
        "f8cf20e6-8f2c-4968-a0a4-01c5d40f2adb",
        "Official",
        "2013",
        "4be03245-0fce-49fa-8f16-f52d14d6e5ca",
      ],
      [
        "f713f3af-51d2-441e-99eb-b239fd6d93c3",
        "Official",
        "2014",
        "4fd056c1-3439-4b4a-a923-294ac66cfd3e",
      ],
      [
        "c3df1247-7729-4ad3-9dcc-f6ae47194c8c",
        "Official",
        "2013-05-15",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
      [
        "189627c8-8dc0-4a86-82fe-558088eac376",
        "Official",
        "2013",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
      [
        "b0d3e010-533e-4182-99f5-14487806aafb",
        "Official",
        "2013-05",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
      [
        "bd91e4d0-1502-4307-b4d3-215f83405528",
        "Official",
        "2013-05-20",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
      [
        "c7fb8e45-e20a-43f0-92b6-9c2f6fa7975e",
        "Official",
        "2013-02-14",
        "5de21cba-b851-4960-a859-4a6a88060a1d",
      ],
      [
        "9025724e-6df0-4343-b45c-7fd8d2284050",
        "Pseudo-Release",
        "2013",
        "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
      ],
    ],
  },
  {
    id: "22ea4f0b-0db2-4e24-a0d0-b60fa92f340b",
    title: "Обійми (bonus track)",
    credits: [{ name: "Океан Ельзи", artistId: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
    firstReleaseDate: "2016",
    releases: [
      [
        "e830aad0-c03c-4e33-aaa0-106e41a2848e",
        "Official",
        "2016",
        "1a83bef9-cb9d-491b-bc9d-f9a696204c7d",
      ],
    ],
  },
  {
    id: "f4100990-432c-47c3-adc4-29a868a2439b",
    title: "Обійми (Yaroslav Tretiak Remix)",
    credits: [{ name: "Океан Ельзи", artistId: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
    firstReleaseDate: "2026-02-20",
    releases: [
      [
        "4d7a8bb4-a0fd-47b8-932c-387406c758ea",
        "Official",
        "2026-02-20",
        "50fbd197-b456-4368-a491-d69ddd43ddae",
      ],
    ],
  },
  {
    id: "09aeabc9-988d-46d5-9e7a-1ab44a543b3b",
    title: "Шум",
    credits: [{ name: "Go_A", artistId: "80b54212-19f5-42ce-bfd7-e08db9c298ae" }],
    disambiguation: "original version",
    firstReleaseDate: "2021-01-22",
    releases: [
      [
        "d81c2735-4ee4-4ec1-a3df-89baa97112fd",
        "Official",
        "2021-01-22",
        "44965ed2-80bb-4787-9996-84c5d3937870",
      ],
    ],
  },
  {
    id: "37f5dc8e-3b15-4953-a768-215d5ff651d3",
    title: "Шум (radio edit)",
    credits: [{ name: "Go_A", artistId: "80b54212-19f5-42ce-bfd7-e08db9c298ae" }],
    firstReleaseDate: "2021-04-02",
    releases: [
      [
        "7675b5a7-6c83-46e5-80e1-b646e39535eb",
        "Official",
        "2021-04-02",
        "44965ed2-80bb-4787-9996-84c5d3937870",
      ],
    ],
  },
  {
    id: "59d2f04f-d238-4b25-a63d-a4c2717628fc",
    title: "ШУМ (official video)",
    credits: [{ name: "Go_A", artistId: "80b54212-19f5-42ce-bfd7-e08db9c298ae" }],
    video: true,
    releases: [],
  },
  {
    id: "7b0367ef-82f0-4170-b26c-c9792b24fee6",
    title: "ШУМ (official music video, Eurovision 2021)",
    credits: [{ name: "Go_A", artistId: "80b54212-19f5-42ce-bfd7-e08db9c298ae" }],
    video: true,
    releases: [],
  },
  {
    id: "cd463bfb-e4d7-4eec-8aef-7b301442c4d1",
    title: "Stefania (Kalush Orchestra)",
    credits: [{ name: "KALUSH", artistId: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25" }],
    disambiguation: "Ukraine, Eurovision 2022 entry, karaoke version",
    firstReleaseDate: "2022-04-08",
    releases: [
      [
        "468f6eed-f67f-409b-ada4-be881d80b878",
        "Official",
        null,
        "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
      ],
    ],
  },
  {
    id: "b3a54e3b-dadd-41f7-8efe-3f5c07e3259c",
    title: "Stefania",
    credits: [{ name: "Kalush Orchestra", artistId: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25" }],
    disambiguation: "Ukraine, Eurovision 2022 entry",
    firstReleaseDate: "2022-02-07",
    releases: [
      [
        "f583ed22-4e4d-412e-b585-e27f2c130263",
        "Official",
        "2022-04-29",
        "3c507fbe-6ed2-4885-926a-7998a70644d0",
      ],
      [
        "70e8153a-3e9a-40a1-9598-9f66986b4721",
        "Official",
        "2023-04-28",
        "94f8aba6-96cf-4dbc-9aec-27348b39c7b6",
      ],
      [
        "e245193b-d0fd-4fbd-9069-5d81b2e4fb35",
        "Official",
        "2022-06-24",
        "91a87b8c-d46c-4b8a-ac8d-543ea5617cff",
      ],
      [
        "e7f30d7e-34c2-4795-a419-cc331bef96c9",
        "Official",
        "2023-04-28",
        "94f8aba6-96cf-4dbc-9aec-27348b39c7b6",
      ],
      [
        "93bdfe05-5ce3-4afd-b1f8-b260bba39872",
        "Official",
        "2022-07-29",
        "0301f8a7-f3c8-40cb-a405-845fc01eecc4",
      ],
      [
        "5901ed97-0fd3-471c-9bdb-c967e8ce54a8",
        "Official",
        "2022-05-20",
        "e715b41e-d879-4c25-aeed-3962ca2a0425",
      ],
      [
        "35ed2bd3-915a-4fb8-96ea-8d6f2aa07707",
        "Official",
        null,
        "56f1d0cf-adf5-4d83-a700-6dbe2232a6d8",
      ],
      [
        "2cac57f3-3cd1-46d3-92cd-96cc9475aec8",
        "Official",
        null,
        "56f1d0cf-adf5-4d83-a700-6dbe2232a6d8",
      ],
      [
        "a5151e7a-03cb-4437-abfa-ea53a7f326ed",
        "Official",
        null,
        "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
      ],
      [
        "a4063304-d3f7-4f9e-8126-0f7e8c3ac777",
        "Official",
        "2022-04-22",
        "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
      ],
      [
        "c4bb928f-c4e7-4713-935b-ce7906d3d0d2",
        "Official",
        null,
        "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
      ],
    ],
  },
  {
    id: "47fd3d33-f944-4e87-b9cc-808ff7ce64a9",
    title: "Stefania (Glitchgirl remix)",
    credits: [{ name: "Kalush Orchestra", artistId: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25" }],
    firstReleaseDate: "2022-05-13",
    releases: [
      [
        "cfa61a92-251b-46b0-a191-84d0b7f62f99",
        null,
        "2022-05-13",
        "a9f0b088-ea8b-460c-9cc4-8516d841f544",
      ],
    ],
  },
  {
    id: "95491132-b493-4399-893a-bf6031052db8",
    title: "Karma Police",
    credits: [{ name: "Radiohead", artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711" }],
    disambiguation: "live, 1997-06-28: Glastonbury Festival, Pilton, UK",
    releases: [
      [
        "38bac4ea-3b88-4f12-abdf-f8ae08bfd684",
        "Bootleg",
        null,
        "441803f3-eb4d-3847-93cf-ab473cf0b8ec",
      ],
    ],
  },
  {
    id: "f909d18e-d8bc-49dd-a405-113a680936f6",
    title: "Karma Police",
    credits: [{ name: "Radiohead", artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711" }],
    disambiguation: "live, 1997-06-28: Worthy Farm, Pilton, England, UK",
    video: true,
    firstReleaseDate: "2005",
    releases: [
      [
        "015f4bd7-bcc7-40b8-b8c5-5b06f0d2b381",
        "Official",
        "2005",
        "a6719e42-eacc-3532-8d63-97cfc0cdcd41",
      ],
    ],
  },
  {
    id: "6c4a524d-641b-413a-bfbe-878974b86345",
    title: "Karma Police",
    credits: [{ name: "Radiohead", artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711" }],
    firstReleaseDate: "1997",
    releases: [
      [
        "4427fb21-4465-480d-accc-899f481d3b38",
        "Official",
        "1997",
        "db8199af-bf6b-4c37-a8ea-0d60c5ef6aca",
      ],
    ],
  },
  {
    id: "98e67e07-e497-48b4-92d1-a0743e162cd2",
    title: "Karma Police",
    credits: [{ name: "The Dresden Dolls", artistId: "107c7983-0728-46ea-8550-77e698adf690" }],
    disambiguation: "live, unknown show",
    releases: [],
  },
  {
    id: "4f3c5b08-fbac-44e1-9b40-6786fc489c05",
    title: "Karma Police",
    credits: [{ name: "Radiohead", artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711" }],
    firstReleaseDate: "1997-08-25",
    releases: [
      [
        "4dbc3e39-a89e-4433-a50a-3a4e7d072da2",
        "Official",
        "1997-08-25",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
    ],
  },
  {
    id: "6517f75e-f85c-4e3c-a25c-fa23d4a6eab8",
    title: "Karma Police (Radiohead Cover)",
    credits: [{ name: "John Vanderslice", artistId: "5eaf11c4-12bf-4545-929b-76f2e03ca208" }],
    firstReleaseDate: "2017-08-18",
    releases: [
      [
        "0f26929e-01ef-481b-ac8e-0935ee537477",
        "Official",
        "2017-08-18",
        "c07c5ecb-0ec5-4cd0-8ae0-b8c4e28156b6",
      ],
    ],
  },
  {
    id: "adbf08e6-2cf8-4dd3-bb5b-bdddba25da27",
    title: "Karma Police",
    credits: [
      {
        name: "Radiohead",
        joinphrase: " feat. ",
        artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      },
      { name: "Michael Stipe", artistId: "905a8f9b-03dc-4f47-b9bb-ecce7ea13ab1" },
    ],
    firstReleaseDate: "2004",
    releases: [
      [
        "70f80946-d618-496f-8384-4e6c5f0578a5",
        "Bootleg",
        "2004",
        "e449d0a3-5661-338c-a51e-a9910f725fa5",
      ],
      [
        "aa1e6810-906c-4d4d-b40b-01f277f6fbd2",
        "Bootleg",
        "2004",
        "e449d0a3-5661-338c-a51e-a9910f725fa5",
      ],
    ],
  },
  {
    id: "47ee964f-95b6-4102-ae39-4d836e1939d1",
    title: "Karma Police (Radiohead cover)",
    credits: [
      { name: "The Brooke (A Tiny Ocean)", artistId: "22e55b1f-2b9d-4d1a-9476-93674ca8d47f" },
    ],
    releases: [
      [
        "1002edb6-b6e6-49ba-af0a-f701fa977976",
        "Official",
        null,
        "b77895f1-343b-4a15-bef4-7951ff460214",
      ],
    ],
  },
  {
    id: "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3",
    title: "Karma Police",
    credits: [{ name: "Radiohead", artistId: "a74b1b7f-71a5-4011-9441-d0b5e4122711" }],
    firstReleaseDate: "1997-05-21",
    releases: [
      [
        "1834eae1-741b-3c03-9ca5-0df3decb43ea",
        "Official",
        "1997-05-21",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "fba5f8fe-c6c8-4511-8562-c9febf482674",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "c7569949-0f67-4682-a0d8-75c4290c52dc",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "52709206-8816-3c12-9ff6-f957f2f1eecf",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "541a0976-ca45-3c0f-89e5-26bc376f58d1",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "ad0e6676-3e55-4bd6-a9ed-7f6424fd46f6",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "a64e09a7-2f26-4d7a-8505-f2561ad3299b",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "425d8db9-88a3-31e2-bd23-b1a967626dd5",
        "Official",
        "1997-06-16",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "4b3d18cc-8937-36f4-8de0-481088be58e6",
        "Official",
        "1997-06-17",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "0b6b4ba0-d36f-47bd-b4ea-6a5b91842d29",
        "Official",
        "1997-07-01",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "6a09041b-0f79-3278-88d9-0552dd28d37f",
        "Official",
        "1997-07-01",
        "b1392450-e666-3926-a536-22c65f834433",
      ],
      [
        "d6eb21af-6595-3aa9-9733-87bc0e245ec1",
        "Official",
        "1997-07",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "bb4f353f-7f15-4946-92e6-77cbfe66b1ea",
        "Official",
        "1997-07",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "b0b892ea-216a-42fe-a395-7fb0e3e41325",
        "Official",
        "1997-08-25",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "2c96e80f-c68b-40fd-abba-c274e6463e38",
        "Official",
        "1997-08-25",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "3b437de0-62a5-42fd-9d00-28786562935f",
        "Bootleg",
        "1997-09",
        "cc6e687b-8e34-4ec4-8b8c-ad7740f7a9e6",
      ],
      [
        "6c939a5d-ea41-47aa-ad97-fb3c76279d72",
        "Official",
        "1997-11-17",
        "26c77d0d-6361-3b85-ace9-70b476e53b25",
      ],
      [
        "4fc611f8-f59b-4497-abf9-c2e2bab48de6",
        "Official",
        "1997-11-17",
        "26c77d0d-6361-3b85-ace9-70b476e53b25",
      ],
      [
        "f9bfc41f-9dab-4909-8658-2e0653c3cd98",
        "Promotion",
        "1997",
        "6ac62eec-209a-44e3-b060-32c35d424d37",
      ],
      [
        "c5c6d967-fdb1-48bf-b283-06b5860e6f35",
        "Bootleg",
        "1997",
        "53f59e5b-adc9-4c36-a724-cf3aeab69b38",
      ],
      [
        "a53d05f6-7ee2-4719-8ed0-82dd2a94c24a",
        "Promotion",
        "1997",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "f1429171-cf32-415f-97c5-23dfc8d2d37d",
        "Promotion",
        "1997",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "63b2c45e-59ae-4909-b454-9d2a57b38d95",
        "Official",
        "1997",
        "d8758f15-65c9-3f34-baf9-475b30755e2b",
      ],
      [
        "d86a24b4-ee1b-420f-8255-9bb37f1c31a6",
        "Official",
        "1997",
        "dcc1a8fa-8d03-4012-a830-dbe74cabd2e1",
      ],
      [
        "24e31042-2e93-4ab8-86e7-68c84661e9af",
        "Official",
        "1997",
        "035848e3-a486-4066-a18b-97a8b57bdb98",
      ],
    ],
  },
  {
    id: "7a0aecf5-0538-42d6-a468-78e0d3a9dead",
    title: "Running up That Hill (A Deal With God) (2012 remix)",
    credits: [{ name: "Kate Bush", artistId: "4b585938-f271-45e2-b19a-91c634b5e396" }],
    firstReleaseDate: "2012-08-10",
    releases: [
      [
        "fed7fd8b-1129-428d-953d-8264c5dc5f70",
        "Official",
        "2012-08-10",
        "46278b1b-47fd-4655-ba14-2eac2a310808",
      ],
      [
        "341dfb18-7867-42a9-99c8-d07579c95fcf",
        "Official",
        "2012-08-10",
        "46278b1b-47fd-4655-ba14-2eac2a310808",
      ],
      [
        "b28c1f07-ef8f-4738-9bdf-a31063f5b8b6",
        "Official",
        "2012-08-13",
        "93178ae7-7d14-4aec-af12-efb5633f6968",
      ],
      [
        "b24c4853-c25f-4fec-9187-00df86ff02b1",
        "Official",
        "2012-08-20",
        "93178ae7-7d14-4aec-af12-efb5633f6968",
      ],
      [
        "5f9d3b62-4563-4fba-b93a-6fc6aab5a8a8",
        "Official",
        "2013-04-20",
        "46278b1b-47fd-4655-ba14-2eac2a310808",
      ],
      [
        "7fae77de-9ef0-48e4-8783-686147cf2323",
        "Official",
        "2013-06-28",
        "0fde4f98-ae21-4390-916c-064551e5d464",
      ],
      [
        "c960a43f-fcb5-40d6-8656-232053012fcd",
        "Official",
        "2013-06-28",
        "0fde4f98-ae21-4390-916c-064551e5d464",
      ],
      [
        "530a6002-ba5d-42c1-819e-9e6f77e2f042",
        "Official",
        "2013-07-09",
        "0fde4f98-ae21-4390-916c-064551e5d464",
      ],
      [
        "75a9ae2e-586a-47c6-8e8b-74a2bae9be3c",
        "Official",
        "2018-11-30",
        "af71236e-1c04-431b-a53d-909b72ba9f2b",
      ],
      [
        "85cf6cec-5821-42c0-b7af-4ed71157160e",
        "Official",
        "2018-11-30",
        "1b7b587e-53f3-410e-af9f-c816dd3b4ed0",
      ],
      [
        "5acc35a8-7177-45c7-99c9-b3b604f8d6a4",
        "Official",
        "2018-11-30",
        "af71236e-1c04-431b-a53d-909b72ba9f2b",
      ],
      [
        "6d86dd1a-b94a-4f26-aeea-367dab41968d",
        "Official",
        "2018-11-30",
        "eb86960f-7902-4971-9ad1-cb4d2a332501",
      ],
      [
        "b0ec38aa-c45c-4add-a0e2-a2249b71233c",
        "Official",
        "2018-11-30",
        "eb86960f-7902-4971-9ad1-cb4d2a332501",
      ],
      [
        "b324e8b8-d0b2-41a4-a892-4ae7a2332e20",
        "Official",
        "2019-03-08",
        "af71236e-1c04-431b-a53d-909b72ba9f2b",
      ],
      [
        "b3ca24cc-9175-4174-84ba-7e7723dc4721",
        "Promotion",
        "2019",
        "af71236e-1c04-431b-a53d-909b72ba9f2b",
      ],
    ],
  },
];

// Release groups the Cover Art Archive has no front cover for, of those the recordings are on.
const recordingGroupsWithoutCover = new Set(["b77895f1-343b-4a15-bef4-7951ff460214"]);

// Old MBIDs of merged release groups, and the one each became.
const merged = new Map([
  ["a51b25f4-2dc1-4787-b779-51abcdb170ff", "9cd2811d-a999-326e-8945-a8b6b44b9e92"],
]);

// Old MBIDs of merged recordings, and the one each became.
const mergedRecordings = new Map([
  ["fcde0790-ab0d-4f3f-b984-211b2b330af9", "7a0aecf5-0538-42d6-a468-78e0d3a9dead"],
]);

// MBIDs the fake fails on as MusicBrainz does when it is down or busy, for the cron's tests.
export const musicBrainzFakeFailing = {
  serverError: "00000000-0000-4000-8000-000000000500",
  busy: "00000000-0000-4000-8000-000000000503",
};

// A credit as MusicBrainz writes one, the artist named as credited.
function creditOf(group: { credits: FakeCredit[] }) {
  return group.credits.map((credit) => ({
    name: credit.name,
    joinphrase: credit.joinphrase ?? "",
    artist: { id: credit.artistId, name: credit.name, "sort-name": credit.name },
  }));
}

// A release group as search answers with it: secondary-types left out when there are none.
function searchResult(group: FakeReleaseGroup) {
  return {
    id: group.id,
    score: 100,
    count: group.releases,
    title: group.title,
    "first-release-date": group.firstReleaseDate ?? "",
    "primary-type": group.primaryType ?? undefined,
    ...(group.secondaryTypes && { "secondary-types": group.secondaryTypes }),
    "artist-credit": creditOf(group),
  };
}

// A release group as a lookup answers with it.
function lookupResult(group: FakeReleaseGroup) {
  return {
    id: group.id,
    title: group.title,
    disambiguation: "",
    "first-release-date": group.firstReleaseDate ?? "",
    "primary-type": group.primaryType,
    "secondary-types": group.secondaryTypes ?? [],
    "artist-credit": creditOf(group),
    aliases: [],
    relations: (group.relations ?? []).map((resource) => ({
      "target-type": "url",
      type: resource.includes("wikidata") ? "wikidata" : "discogs",
      url: { resource },
    })),
  };
}

// The words of a Lucene query, its escapes undone, lowercased.
function wordsOf(query: string): string[] {
  return query.replace(/\\(.)/g, "$1").toLowerCase().split(/\s+/).filter(Boolean);
}

// A search query of the shape the Worker sends, `(<words>) AND (primarytype:album OR …)`: the
// release groups whose title and artist credit hold every word, of the primary types it names.
function search(query: string): FakeReleaseGroup[] {
  const match = /^\((.*)\) AND \((.*)\)$/s.exec(query);
  const words = wordsOf(match?.[1] ?? query);
  const types = [...(match?.[2] ?? "").matchAll(/primarytype:(\w+)/g)].map((m) => m[1]);
  return releaseGroups.filter((group) => {
    const text = `${group.title} ${group.credits.map((c) => c.name).join(" ")}`.toLowerCase();
    const typed = types.length === 0 || types.includes(group.primaryType?.toLowerCase());
    return typed && words.every((word) => text.includes(word));
  });
}

// A recording's releases as a search or a lookup lists them: a search leaves out a release group's
// secondary-types when there are none, and a lookup lists at most 25 releases, as MusicBrainz does.
function releasesOf(recording: FakeRecording, lookup: boolean) {
  const releases = lookup ? recording.releases.slice(0, 25) : recording.releases;
  return releases.map(([id, status, date, groupId]) => {
    const group = recordingGroups[groupId];
    if (!group) throw new Error(`No release group ${groupId}`);
    const secondaryTypes = group.secondaryTypes ?? [];
    return {
      id,
      status,
      ...(date && { date }),
      "release-group": {
        id: groupId,
        title: group.title,
        "primary-type": group.primaryType,
        ...((lookup || secondaryTypes.length > 0) && { "secondary-types": secondaryTypes }),
      },
    };
  });
}

function recordingResult(recording: FakeRecording, lookup: boolean) {
  return {
    id: recording.id,
    ...(!lookup && { score: 100 }),
    title: recording.title,
    disambiguation: recording.disambiguation ?? "",
    video: recording.video ?? false,
    ...(recording.firstReleaseDate && { "first-release-date": recording.firstReleaseDate }),
    "artist-credit": creditOf(recording),
    releases: releasesOf(recording, lookup),
  };
}

// Whether a disambiguation has the word, as Lucene matches comment:<word>.
function hasWord(text: string | undefined, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${word}([^\\p{L}\\p{N}]|$)`, "iu").test(text ?? "");
}

// A recording search of the shape the Worker sends (ADR-0013): the recordings whose title or
// artist credit holds each word, less the videos, those on no release and those whose
// disambiguation has the word live or karaoke, when the query leaves them out. The boosts are
// ignored, so the order is the fake's own.
function searchRecordings(query: string): FakeRecording[] {
  const words = [...query.matchAll(/\(recording:(\S+) OR artist:\S+\)/g)].map((match) =>
    (match[1] ?? "").replace(/\\(.)/g, "$1").toLowerCase(),
  );
  return recordings.filter((recording) => {
    const credit = recording.credits.map((each) => each.name).join(" ");
    const named = words.every((word) =>
      `${recording.title} ${credit}`.toLowerCase().includes(word),
    );
    const hidden =
      (query.includes("NOT video:true") && recording.video === true) ||
      (query.includes("NOT comment:live") && hasWord(recording.disambiguation, "live")) ||
      (query.includes("NOT comment:karaoke") && hasWord(recording.disambiguation, "karaoke")) ||
      (query.includes("reid:*") && recording.releases.length === 0);
    return words.length > 0 && named && !hidden;
  });
}

const notFound = {
  error: "Not Found",
  help: "For usage, please see: https://musicbrainz.org/development/mmd",
};

// How many calls the rate limit has refused, which a test reads to see that the Worker paced every
// call, and when the last call came.
let rateLimited = 0;
let lastCall = 0;

// How many of a /busy/ id's calls have had their 503.
const busyAnswered = new Map<string, number>();

export const musicBrainzFakeCalls = {
  rateLimited: () => rateLimited,
};

const defaultInterval = 1100;

const api = new Hono<{ Bindings: Partial<Pick<Env, "MUSICBRAINZ_INTERVAL_MS">> }>();

// MusicBrainz takes the search with or without the trailing slash.
const searchHandler = (c: Context) => {
  const query = c.req.query("query") ?? "";
  const limit = Number(c.req.query("limit") ?? 25);
  const albumsList = artistAlbumsSearch(query, limit);
  if (albumsList) return c.json(albumsList);
  const found = search(query);
  return c.json({
    created: "2026-11-21T09:38:48.318Z",
    count: found.length,
    offset: 0,
    "release-groups": found.slice(0, limit).map(searchResult),
  });
};

api.get("/ws/2/release-group", searchHandler);
api.get("/ws/2/release-group/", searchHandler);

const recordingSearchHandler = (c: Context) => {
  const query = c.req.query("query") ?? "";
  const limit = Number(c.req.query("limit") ?? 25);
  const found = searchRecordings(query);
  return c.json({
    created: "2026-11-22T14:07:00.000Z",
    count: found.length,
    offset: 0,
    recordings: found.slice(0, limit).map((recording) => recordingResult(recording, false)),
  });
};

api.get("/ws/2/recording", recordingSearchHandler);
api.get("/ws/2/recording/", recordingSearchHandler);

api.get("/ws/2/recording/:mbid", (c) => {
  const id = c.req.param("mbid");
  if (id === musicBrainzFakeFailing.serverError) return c.json({ error: "Server error" }, 500);
  if (id === musicBrainzFakeFailing.busy) return c.json({ error: "Service unavailable" }, 503);
  const target = mergedRecordings.get(id);
  if (target) {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(id, target);
    return c.redirect(url.toString(), 301);
  }
  const recording = recordings.find((each) => each.id === id);
  return recording ? c.json(recordingResult(recording, true)) : c.json(notFound, 404);
});

api.get("/ws/2/release-group/:mbid", (c) => {
  const id = c.req.param("mbid");
  if (id === musicBrainzFakeFailing.serverError) return c.json({ error: "Server error" }, 500);
  if (id === musicBrainzFakeFailing.busy) return c.json({ error: "Service unavailable" }, 503);
  const target = merged.get(id);
  if (target) {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(id, target);
    return c.redirect(url.toString(), 301);
  }
  const group = releaseGroups.find((each) => each.id === id);
  return group ? c.json(lookupResult(group)) : c.json(notFound, 404);
});

const artistSearchHandler = (c: Context) => {
  const limit = Number(c.req.query("limit") ?? 25);
  return c.json(artistSearch(c.req.query("query") ?? "", limit));
};

api.get("/ws/2/artist", artistSearchHandler);
api.get("/ws/2/artist/", artistSearchHandler);

api.get("/ws/2/artist/:mbid", (c) => {
  const id = c.req.param("mbid");
  if (id === musicBrainzFakeFailing.serverError) return c.json({ error: "Server error" }, 500);
  if (id === musicBrainzFakeFailing.busy) return c.json({ error: "Service unavailable" }, 503);
  const target = mergedArtists.get(id);
  if (target) {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(id, target);
    return c.redirect(url.toString(), 301);
  }
  const artist = artistLookup(id);
  return artist ? c.json(artist) : c.json(notFound, 404);
});

// Under /busy/<times>/<id>/ the first <times> calls with that id are answered 503.
const busyRoutes = new Hono<{ Bindings: Partial<Pick<Env, "MUSICBRAINZ_INTERVAL_MS">> }>();

busyRoutes.use("/busy/:times/:id/*", async (c, next) => {
  const id = c.req.param("id");
  const answered = busyAnswered.get(id) ?? 0;
  if (answered < Number(c.req.param("times"))) {
    busyAnswered.set(id, answered + 1);
    return c.json({ error: "Service unavailable" }, 503);
  }
  await next();
});

busyRoutes.route("/busy/:times/:id", api);
busyRoutes.route("/", api);

// What MusicBrainz answers a call past its rate limit, with a 503.
const rateLimitAnswer = { error: "Your requests are exceeding the allowable rate limit." };

// The browser paces its song searches 1.1 s apart, always (ADR-0013); a test forwards them here
// (tests/support/ui/musicbrainz.ts), which can shorten a gap a little, so the fake allows this.
const browserInterval = 1000;

// When each test browser's last call came. Each is limited on its own, as MusicBrainz limits each
// User's IP, so parallel tests' searches don't take each other's turns, or the Worker's.
const browserLastCalls = new Map<string, number>();

export const musicBrainzFake = new Hono<{
  Bindings: Partial<Pick<Env, "MUSICBRAINZ_INTERVAL_MS">>;
}>();

// A test browser's calls, under /browser/<id>/, are refused when one comes sooner than the
// browser's interval after its last.
musicBrainzFake.use("/browser/:browser/*", async (c, next) => {
  const browser = c.req.param("browser");
  const now = Date.now();
  const tooSoon = now - (browserLastCalls.get(browser) ?? 0) < browserInterval;
  browserLastCalls.set(browser, now);
  if (tooSoon) return c.json(rateLimitAnswer, 503);
  await next();
});

// The Worker's rate limit, over every call of the Worker's, the busy ones' among them.
musicBrainzFake.use("*", async (c, next) => {
  if (/\/musicbrainz\/browser\//.test(c.req.path)) return next();
  const now = Date.now();
  const interval = Number(c.env?.MUSICBRAINZ_INTERVAL_MS ?? defaultInterval);
  const tooSoon = now - lastCall < interval;
  lastCall = now;
  if (tooSoon) {
    rateLimited += 1;
    return c.json(rateLimitAnswer, 503);
  }
  await next();
});

musicBrainzFake.route("/browser/:browser", busyRoutes);
musicBrainzFake.route("/", busyRoutes);

// A square front cover, as the Cover Art Archive's image stands in for it here.
const coverImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 1 1">' +
  '<rect width="1" height="1" fill="#777"/></svg>';

// The Cover Art Archive answers a release group with a front cover with its image, and one
// without, or one it doesn't know, with 404. A merged one's old MBID answers with the new one's.
export const coverArtArchiveFake = new Hono();

coverArtArchiveFake.get("/release-group/:mbid/:size{front-[0-9]+}", (c) => {
  const id = c.req.param("mbid");
  const group = releaseGroups.find((each) => each.id === (merged.get(id) ?? id));
  const songsGroup = id in recordingGroups && !recordingGroupsWithoutCover.has(id);
  if (!group?.cover && !songsGroup) return c.text("Not Found", 404);
  return c.body(coverImage, 200, { "Content-Type": "image/svg+xml" });
});

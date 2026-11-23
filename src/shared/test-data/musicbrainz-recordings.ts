// MusicBrainz's own answers for recordings (checked 2026-11-22, in the recording search check of
// docs/research/music-metadata-sources.md), cut to the fields TasteTrack reads, for the unit tests
// of song search (../musicbrainz-songs.test.ts) and of a song's details in the Worker.

export const radiohead = {
  name: "Radiohead",
  artist: { id: "a74b1b7f-71a5-4011-9441-d0b5e4122711" },
};
export const okeanElzy = {
  name: "Океан Ельзи",
  artist: { id: "87a417d3-f118-43e0-bece-3de1bd90fce0" },
};

export interface Group {
  id: string;
  title: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
}

export interface Release {
  id: string;
  status?: string | null;
  date?: string;
  "release-group": Group;
}

export interface Recording {
  id: string;
  title: string;
  "artist-credit": { name: string; joinphrase?: string; artist: { id: string } }[];
  disambiguation?: string;
  video?: boolean;
  "first-release-date"?: string;
  releases?: Release[];
}

export const okComputer: Group = {
  id: "b1392450-e666-3926-a536-22c65f834433",
  title: "OK Computer",
  "primary-type": "Album",
};
export const karmaPoliceSingle: Group = {
  id: "d8758f15-65c9-3f34-baf9-475b30755e2b",
  title: "Karma Police",
  "primary-type": "Single",
};
export const nowThatsMusic38: Group = {
  id: "26c77d0d-6361-3b85-ace9-70b476e53b25",
  title: "Now That’s What I Call Music! 38",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Karma Police on OK Computer, its single and a compilation, the second release listed twice, as
// a search lists a release that has the recording twice.
export const karmaPolice: Recording = {
  id: "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997-05-21",
  releases: [
    {
      id: "1834eae1-741b-3c03-9ca5-0df3decb43ea",
      status: "Official",
      date: "1997-05-21",
      "release-group": okComputer,
    },
    {
      id: "fba5f8fe-c6c8-4511-8562-c9febf482674",
      status: "Official",
      date: "1997-06-16",
      "release-group": okComputer,
    },
    {
      id: "fba5f8fe-c6c8-4511-8562-c9febf482674",
      status: "Official",
      date: "1997-06-16",
      "release-group": okComputer,
    },
    {
      id: "d6eb21af-6595-3aa9-9733-87bc0e245ec1",
      status: "Official",
      date: "1997-07",
      "release-group": karmaPoliceSingle,
    },
    {
      id: "6c939a5d-ea41-47aa-ad97-fb3c76279d72",
      status: "Official",
      date: "1997-11-17",
      "release-group": nowThatsMusic38,
    },
  ],
};

export const leMeilleuxMix97: Group = {
  id: "db8199af-bf6b-4c37-a8ea-0d60c5ef6aca",
  title: "Le Meilleux Mix 97",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Two of Radiohead's other recordings of Karma Police, each on one release: a compilation dated by
// its year alone, and the single, dated to the day.
export const onACompilation: Recording = {
  id: "6c4a524d-641b-413a-bfbe-878974b86345",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997",
  releases: [
    {
      id: "4427fb21-4465-480d-accc-899f481d3b38",
      status: "Official",
      date: "1997",
      "release-group": leMeilleuxMix97,
    },
  ],
};
export const onTheSingle: Recording = {
  id: "4f3c5b08-fbac-44e1-9b40-6786fc489c05",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997-08-25",
  releases: [
    {
      id: "4dbc3e39-a89e-4433-a50a-3a4e7d072da2",
      status: "Official",
      date: "1997-08-25",
      "release-group": karmaPoliceSingle,
    },
  ],
};

export const towering: Group = {
  id: "e449d0a3-5661-338c-a51e-a9910f725fa5",
  title: "Towering Above the Rest",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// The same song credited to Radiohead with Michael Stipe, on two bootlegs.
export const withMichaelStipe: Recording = {
  id: "adbf08e6-2cf8-4dd3-bb5b-bdddba25da27",
  title: "Karma Police",
  "artist-credit": [
    { ...radiohead, joinphrase: " feat. " },
    { name: "Michael Stipe", artist: { id: "905a8f9b-03dc-4f47-b9bb-ecce7ea13ab1" } },
  ],
  disambiguation: "",
  "first-release-date": "2004",
  releases: [
    {
      id: "70f80946-d618-496f-8384-4e6c5f0578a5",
      status: "Bootleg",
      date: "2004",
      "release-group": towering,
    },
    {
      id: "aa1e6810-906c-4d4d-b40b-01f277f6fbd2",
      status: "Bootleg",
      date: "2004",
      "release-group": towering,
    },
  ],
};

// A cover by another artist, whose title names Radiohead.
export const johnVanderslice: Recording = {
  id: "6517f75e-f85c-4e3c-a25c-fa23d4a6eab8",
  title: "Karma Police (Radiohead Cover)",
  "artist-credit": [
    { name: "John Vanderslice", artist: { id: "5eaf11c4-12bf-4545-929b-76f2e03ca208" } },
  ],
  disambiguation: "",
  "first-release-date": "2017-08-18",
  releases: [
    {
      id: "0f26929e-01ef-481b-ac8e-0935ee537477",
      status: "Official",
      date: "2017-08-18",
      "release-group": {
        id: "c07c5ecb-0ec5-4cd0-8ae0-b8c4e28156b6",
        title: "Philia - Artists Rise Against Islamophobia",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

export const zemlya: Group = {
  id: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
  title: "Земля",
  "primary-type": "Album",
};

// Обійми on Земля, the single before it and compilations dated by their year alone; one Земля
// is a pseudo-release, a transliteration, which never counts.
export const obiimy: Recording = {
  id: "d8d55f18-0c4b-4036-a16d-e273ac8953fc",
  title: "Обійми",
  "artist-credit": [okeanElzy],
  disambiguation: "",
  "first-release-date": "2013-02-14",
  releases: [
    {
      id: "f8cf20e6-8f2c-4968-a0a4-01c5d40f2adb",
      status: "Official",
      date: "2013",
      "release-group": {
        id: "4be03245-0fce-49fa-8f16-f52d14d6e5ca",
        title: "Избранное",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "f713f3af-51d2-441e-99eb-b239fd6d93c3",
      status: "Official",
      date: "2014",
      "release-group": {
        id: "4fd056c1-3439-4b4a-a923-294ac66cfd3e",
        title: "Найкраще",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5ec4f47f-9d7c-4469-82ba-4d5982a6de74",
      status: "Official",
      date: "2013-05-15",
      "release-group": zemlya,
    },
    {
      id: "b0d3e010-533e-4182-99f5-14487806aafb",
      status: "Official",
      date: "2013-05",
      "release-group": zemlya,
    },
    {
      id: "c7fb8e45-e20a-43f0-92b6-9c2f6fa7975e",
      status: "Official",
      date: "2013-02-14",
      "release-group": {
        id: "5de21cba-b851-4960-a859-4a6a88060a1d",
        title: "Обійми",
        "primary-type": "Single",
      },
    },
    {
      id: "9025724e-6df0-4343-b45c-7fd8d2284050",
      status: "Pseudo-Release",
      date: "2013",
      "release-group": zemlya,
    },
  ],
};

export const kalushOrchestra = {
  name: "Kalush Orchestra",
  artist: { id: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25" },
};
export const turin2022: Group = {
  id: "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
  title: "Eurovision Song Contest: Turin 2022",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Stefania on compilations first, then its EP, and its single with no date.
export const stefania: Recording = {
  id: "b3a54e3b-dadd-41f7-8efe-3f5c07e3259c",
  title: "Stefania",
  "artist-credit": [kalushOrchestra],
  disambiguation: "Ukraine, Eurovision 2022 entry",
  "first-release-date": "2022-02-07",
  releases: [
    {
      id: "a4063304-d3f7-4f9e-8126-0f7e8c3ac777",
      status: "Official",
      date: "2022-04-22",
      "release-group": turin2022,
    },
    {
      id: "f583ed22-4e4d-412e-b585-e27f2c130263",
      status: "Official",
      date: "2022-04-29",
      "release-group": {
        id: "3c507fbe-6ed2-4885-926a-7998a70644d0",
        title: "Bravo Hits 117",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5901ed97-0fd3-471c-9bdb-c967e8ce54a8",
      status: "Official",
      date: "2022-05-20",
      "release-group": {
        id: "e715b41e-d879-4c25-aeed-3962ca2a0425",
        title: "Stefania",
        "primary-type": "EP",
      },
    },
    {
      id: "35ed2bd3-915a-4fb8-96ea-8d6f2aa07707",
      status: "Official",
      "release-group": {
        id: "56f1d0cf-adf5-4d83-a700-6dbe2232a6d8",
        title: "Stefania",
        "primary-type": "Single",
      },
    },
  ],
};

// A remix on a release with no status, so on no Official release.
export const glitchgirlRemix: Recording = {
  id: "47fd3d33-f944-4e87-b9cc-808ff7ce64a9",
  title: "Stefania (Glitchgirl remix)",
  "artist-credit": [kalushOrchestra],
  disambiguation: "",
  "first-release-date": "2022-05-13",
  releases: [
    {
      id: "cfa61a92-251b-46b0-a191-84d0b7f62f99",
      status: null,
      date: "2022-05-13",
      "release-group": {
        id: "a9f0b088-ea8b-460c-9cc4-8516d841f544",
        title: "The Sound of a Remix: The Eurovision 2022 Song Contest",
        "primary-type": "Other",
        "secondary-types": ["Compilation", "Remix"],
      },
    },
  ],
};

// Running Up That Hill's 2012 remix: a remix single, then a soundtrack, which counts as a studio
// release, and compilations.
export const symphonyOfBritishMusic: Group = {
  id: "93178ae7-7d14-4aec-af12-efb5633f6968",
  title:
    "A Symphony of British Music: Music for the Closing Ceremony of the London 2012 Olympic Games",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
};
export const runningUpThatHill: Recording = {
  id: "7a0aecf5-0538-42d6-a468-78e0d3a9dead",
  title: "Running up That Hill (A Deal With God) (2012 remix)",
  "artist-credit": [{ name: "Kate Bush", artist: { id: "4b585938-f271-45e2-b19a-91c634b5e396" } }],
  disambiguation: "",
  "first-release-date": "2012-08-10",
  releases: [
    {
      id: "fed7fd8b-1129-428d-953d-8264c5dc5f70",
      status: "Official",
      date: "2012-08-10",
      "release-group": {
        id: "46278b1b-47fd-4655-ba14-2eac2a310808",
        title: "Running Up That Hill (A Deal With God) (2012 remix)",
        "primary-type": "Single",
        "secondary-types": ["Remix"],
      },
    },
    {
      id: "b28c1f07-ef8f-4738-9bdf-a31063f5b8b6",
      status: "Official",
      date: "2012-08-13",
      "release-group": symphonyOfBritishMusic,
    },
    {
      id: "75a9ae2e-586a-47c6-8e8b-74a2bae9be3c",
      status: "Official",
      date: "2018-11-30",
      "release-group": {
        id: "af71236e-1c04-431b-a53d-909b72ba9f2b",
        title: "The Other Sides",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

// Look-alikes from the search for "time of my life bill medley jennifer warnes" (checked
// 2026-11-23), each cut to its first releases, which keeps their order by releases: 218, 20 and 1.
// The Time of My Life with a curly apostrophe, credited with "and", on the most releases.
export const timeOfMyLifeWithAnd: Recording = {
  id: "b0e451f4-efc9-473d-a4dc-43bb3be9839c",
  title: "(I’ve Had) The Time of My Life",
  "artist-credit": [
    {
      name: "Bill Medley",
      joinphrase: " and ",
      artist: {
        id: "5a68345c-0ae8-4ec3-af35-38f2a39bcf0b",
      },
    },
    {
      name: "Jennifer Warnes",
      artist: {
        id: "2f140aa6-b99b-4f79-ae33-96018af87fa3",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "1987-08-04",
  releases: [
    {
      id: "cf33c818-9f1d-46c1-a7fe-b044a73d29bc",
      status: "Official",
      date: "2026-06-12",
      "release-group": {
        id: "76b06180-7097-4ded-b7aa-8180c6786120",
        title: "NOW That's What I Call An 80s Summer",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "dbc2ed87-7098-4fc4-8c7f-d775ba95705c",
      status: "Official",
      date: "2024-01-19",
      "release-group": {
        id: "84cdcd8c-dc6a-4a93-b5ad-f3a7788956d9",
        title: "The Hits Album: The 80s Love Album",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "314fee25-3d91-4e20-aed8-c4ceefd6a456",
      status: "Official",
      date: "2009",
      "release-group": {
        id: "8ba319d8-40ab-47c3-a986-5c940b451b0d",
        title: "100 Love Songs",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};
// The same title credited with "&".
export const timeOfMyLifeWithAmpersand: Recording = {
  id: "10d92e47-448f-465c-b1da-2be317d9e627",
  title: "(I’ve Had) The Time of My Life",
  "artist-credit": [
    {
      name: "Bill Medley",
      joinphrase: " & ",
      artist: {
        id: "5a68345c-0ae8-4ec3-af35-38f2a39bcf0b",
      },
    },
    {
      name: "Jennifer Warnes",
      artist: {
        id: "2f140aa6-b99b-4f79-ae33-96018af87fa3",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "1987",
  releases: [
    {
      id: "37945580-f9d2-420d-a73d-d3f5685ff6a0",
      status: "Official",
      date: "2007-06-01",
      "release-group": {
        id: "4e1d9d57-e2b3-46e4-b97d-42a01bc57f6c",
        title: "Let’s Dance Vol. 2: Die Tanzhits zur Show",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5bd38e66-f2e9-4862-88b3-c8f37d9071d4",
      status: "Official",
      date: "2012-01-01",
      "release-group": {
        id: "3b99f9f0-6b99-40e0-b0f0-d23f4153cb4a",
        title: "Je t’aime 2012",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};
// The title with a straight apostrophe, credited to one artist named with "&", on the soundtrack.
export const timeOfMyLifeStraightApostrophe: Recording = {
  id: "2d3ca1f3-642c-4a60-9d98-18e8a2f61056",
  title: "(I've Had) The Time of My Life",
  "artist-credit": [
    {
      name: "Bill Medley & Jennifer Warnes",
      artist: {
        id: "5a68345c-0ae8-4ec3-af35-38f2a39bcf0b",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "1987-07-18",
  releases: [
    {
      id: "ecebd1a6-8265-4c2b-b616-6b833118a925",
      status: "Official",
      date: "1987-07-18",
      "release-group": {
        id: "07ef562e-56a7-4fc9-b9b5-8521e9b9bd4b",
        title: "Dirty Dancing (Original Motion Picture Soundtrack)",
        "primary-type": "Album",
        "secondary-types": ["Compilation", "Soundtrack"],
      },
    },
  ],
};
// A title that lacks the words "I've Had" and "The".
export const timeOfMyLifeWithoutIveHad: Recording = {
  id: "5721dfdd-2abd-4c15-8a23-bc147892c42d",
  title: "Time of My Life",
  "artist-credit": [
    {
      name: "Bill Medley",
      joinphrase: " & ",
      artist: {
        id: "5a68345c-0ae8-4ec3-af35-38f2a39bcf0b",
      },
    },
    {
      name: "Jennifer Warnes",
      artist: {
        id: "2f140aa6-b99b-4f79-ae33-96018af87fa3",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "2016",
  releases: [
    {
      id: "802c9f6b-817f-4989-a190-30839ed46f84",
      status: "Official",
      date: "2016",
      "release-group": {
        id: "4260c6f7-7216-4576-8f93-d7af6dc03695",
        title: "Het beste uit de Top 500 van het foute uur",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

// Two of Beyoncé's recordings of one Déjà Vu remix, from the search for "deja vu beyonce" (checked
// 2026-11-23): its title with accents and in two pairs of brackets, on singles, cut to three
// releases, and without accents, a comma between the remix and "no rap", on one promotion.
export const dejaVuNoRapAccented: Recording = {
  id: "c4454dfa-7f11-4c54-a703-f684f647689b",
  title: "Déjà Vu (Freemasons club mix) (no rap)",
  "artist-credit": [
    {
      name: "Beyoncé",
      artist: {
        id: "859d0860-d480-4efd-970c-c05d5f1776b8",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "2006-08-15",
  releases: [
    {
      id: "0158388f-f859-49e4-9051-a1b40cddc285",
      status: "Promotion",
      date: "2006-09-20",
      "release-group": {
        id: "71166baf-66ba-3c47-90c6-573edc3d475a",
        title: "Promo Only: Underground Club, November 2006",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "d214d6e6-d119-40b1-be31-30f7f3a267bb",
      status: "Promotion",
      date: "2006",
      "release-group": {
        id: "4880d6ab-3074-3483-9297-6f0dbb518688",
        title: "Deja vu",
        "primary-type": "Single",
      },
    },
    {
      id: "846ae7f5-d3c8-4b46-952b-542def7dc199",
      status: "Official",
      date: "2006-08-21",
      "release-group": {
        id: "4880d6ab-3074-3483-9297-6f0dbb518688",
        title: "Deja vu",
        "primary-type": "Single",
      },
    },
  ],
};
export const dejaVuNoRapUnaccented: Recording = {
  id: "ef67278f-dc5b-449d-88bb-a2efa1d99ade",
  title: "Deja Vu (Freemasons club mix, no rap)",
  "artist-credit": [
    {
      name: "Beyoncé",
      artist: {
        id: "859d0860-d480-4efd-970c-c05d5f1776b8",
      },
    },
  ],
  disambiguation: "",
  "first-release-date": "2006",
  releases: [
    {
      id: "b47a4cf6-c10b-4f5e-9412-f3a8757a7cb3",
      status: "Promotion",
      date: "2006",
      "release-group": {
        id: "436d2ea1-47df-4e98-863b-d81cbb9f51ef",
        title: "Promo Only: Mainstream Club, October 2006",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

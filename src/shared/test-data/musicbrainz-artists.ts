// MusicBrainz's own answers for artists and their albums (checked 2026-11-24, after the artist
// search check of docs/research/music-metadata-sources.md), cut to the fields TasteTrack reads, for
// the unit tests of artist search (../musicbrainz-artists.test.ts) and of an artist's details in
// the Worker.

// Search rows. A search leaves out a disambiguation and a country it has none of, and sets
// `country` only where the area is a country: Pink Floyd's is England, so its row has none.
export const okeanElzy = {
  id: "87a417d3-f118-43e0-bece-3de1bd90fce0",
  name: "Океан Ельзи",
  type: "Group",
  country: "UA",
  "life-span": { begin: "1994-10-12", ended: null },
};

export const kalush = {
  id: "628d9735-f961-4eb0-92ee-31d77f9c8b8f",
  name: "KALUSH",
  type: "Group",
  country: "UA",
  "life-span": { begin: "2019", ended: null },
};

export const kalushOrchestra = {
  id: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25",
  name: "Kalush Orchestra",
  type: "Group",
  country: "UA",
  "life-span": { begin: "2021", ended: null },
};

// A solo artist and a group of one name, told apart by their disambiguations.
export const aliceCooper = {
  id: "ee58c59f-8e7f-4430-b8ca-236c4d3745ae",
  name: "Alice Cooper",
  type: "Person",
  country: "US",
  "life-span": { begin: "1948-02-04", ended: null },
  disambiguation: "the singer, active as a solo artist 1975–present",
};

export const aliceCooperBand = {
  id: "4d7928cd-7ed2-4282-8c29-c0c9f966f1bd",
  name: "Alice Cooper",
  type: "Group",
  country: "US",
  "life-span": { begin: "1964", end: "1975", ended: true },
  disambiguation: "the band, active 1964–1974/5",
};

// An ended group.
export const pinkFloyd = {
  id: "83d91898-7763-47d7-b03b-b92132375c47",
  name: "Pink Floyd",
  type: "Group",
  "life-span": { begin: "1965", end: "2014", ended: true },
};

// Ended, with no end date.
export const queen = {
  id: "0383dadf-2a4e-4d10-a46a-e9e041da8eb3",
  name: "Queen",
  type: "Group",
  country: "GB",
  "life-span": { begin: "1970-06-27", ended: true },
  disambiguation: "UK rock group",
};

// The special-purpose Various Artists, and two real artists of that name.
export const variousArtists = {
  id: "89ad4ac3-39f7-470e-963a-56509c546377",
  name: "Various Artists",
  type: "Other",
  "life-span": { ended: null },
  disambiguation: "add compilations to this artist",
};

export const variousArtistsTechno = {
  id: "4e46dd54-81a6-4a75-a666-d0e447861e3f",
  name: "Various Artists",
  type: "Person",
  country: "DE",
  "life-span": { ended: null },
  disambiguation: "German techno producer Torsten Pröfrock, DO NOT add compilations",
};

export const variousArtistsBristol = {
  id: "8e107957-c443-45b4-84f7-8b054499ef78",
  name: "Various Artists",
  type: "Group",
  "life-span": { ended: null },
  disambiguation: "UK band from Bristol",
};

// A special-purpose artist, of the worldwide "country" XW.
export const unknown = {
  id: "125ec42a-7229-4250-afc5-e057484327fe",
  name: "[unknown]",
  type: "Other",
  country: "XW",
  "life-span": { ended: null },
  disambiguation: "Special Purpose Artist – Do not add releases here, if possible.",
};

// A lookup with URL relations, which gives a country even where the area is England, and an
// empty disambiguation.
export const pinkFloydLookup = {
  id: "83d91898-7763-47d7-b03b-b92132375c47",
  name: "Pink Floyd",
  type: "Group",
  country: "GB",
  area: { name: "England" },
  "life-span": { begin: "1965", end: "2014", ended: true },
  disambiguation: "",
  relations: [
    {
      type: "discogs",
      "target-type": "url",
      url: { resource: "https://www.discogs.com/artist/45467" },
    },
    {
      type: "wikidata",
      "target-type": "url",
      url: { resource: "https://www.wikidata.org/wiki/Q2306" },
    },
  ],
};

// Release groups of an albums-list search, as it answers them: secondary-types left out when there
// are none.
export const piperAtTheGates = {
  id: "6792b6d1-4e65-3c3c-9d20-d08aa1dcfc60",
  title: "The Piper at the Gates of Dawn",
  "first-release-date": "1967-07-07",
  "primary-type": "Album",
};

export const saucerfulOfSecrets = {
  id: "8a9caa40-b7c6-33eb-a13c-6c15f09b1c44",
  title: "A Saucerful of Secrets",
  "first-release-date": "1968-06-29",
  "primary-type": "Album",
};

// A soundtrack album.
export const more = {
  id: "43d42d00-46fb-3d9c-9612-03d30fb20307",
  title: "More",
  "first-release-date": "1969-06-13",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
};

export const ummagumma = {
  id: "b7aa61ae-3572-32c0-8b93-6af78ea83760",
  title: "Ummagumma",
  "first-release-date": "1969-10-25",
  "primary-type": "Album",
};

// An EP dated by its year alone.
export const london1966 = {
  id: "981911ba-b43a-312a-a1b7-afb819a3d223",
  title: "London 1966/1967",
  "first-release-date": "1995",
  "primary-type": "EP",
};

export const theirFirstRecordings = {
  id: "8cfe1674-1fd4-45d4-ad2d-b30951d07a59",
  title: "1965: Their First Recordings",
  "first-release-date": "2015-11-27",
  "primary-type": "EP",
};

export const endlessRiver = {
  id: "38b4c840-16ce-40fa-b7c0-a354b7c87178",
  title: "The Endless River",
  "first-release-date": "2014-11-07",
  "primary-type": "Album",
};

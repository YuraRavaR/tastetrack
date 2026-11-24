// Wikidata's and Wikimedia Commons' own answers for artists' photos (checked 2026-11-24, after the
// artist search check of docs/research/music-metadata-sources.md), cut to the fields TasteTrack
// reads: P18 claims from wbgetclaims, and a file's image info from Commons. The Worker's unit
// tests read them, and the Wikimedia fake answers with them.

// Q1008489, one image of normal rank.
export const okeanElzyClaims = {
  claims: {
    P18: [
      {
        mainsnak: {
          snaktype: "value",
          property: "P18",
          datavalue: { value: "OkeanElzi25.jpg", type: "string" },
          datatype: "commonsMedia",
        },
        type: "statement",
        rank: "normal",
      },
    ],
  },
};

// Q80808767, an image of normal rank before one of preferred rank.
export const kalushOrchestraClaims = {
  claims: {
    P18: [
      {
        mainsnak: {
          snaktype: "value",
          property: "P18",
          datavalue: { value: "Kalush Orchestra, May 2022.png", type: "string" },
          datatype: "commonsMedia",
        },
        type: "statement",
        rank: "normal",
      },
      {
        mainsnak: {
          snaktype: "value",
          property: "P18",
          datavalue: {
            value:
              "- EU2024BE Informal meeting of EU Affairs Ministers BOZAR JNZT 0103 (53687141247).jpg",
            type: "string",
          },
          datatype: "commonsMedia",
        },
        type: "statement",
        rank: "preferred",
      },
    ],
  },
};

// Q1855965, the 1960s UK Nirvana, with no image.
export const nirvanaUkClaims = { claims: {} };

// Q44190, Radiohead, one image of normal rank.
export const radioheadClaims = {
  claims: {
    P18: [
      {
        mainsnak: {
          snaktype: "value",
          property: "P18",
          datavalue: { value: "RadioheadO2211125 composite.jpg", type: "string" },
          datatype: "commonsMedia",
        },
        type: "statement",
        rank: "normal",
      },
    ],
  },
};

// Q2306, Pink Floyd, one image of normal rank.
export const pinkFloydClaims = {
  claims: {
    P18: [
      {
        mainsnak: {
          snaktype: "value",
          property: "P18",
          datavalue: { value: "Pink Floyd, 1971 (HQ).jpg", type: "string" },
          datatype: "commonsMedia",
        },
        type: "statement",
        rank: "normal",
      },
    ],
  },
};

// OkeanElzi25.jpg: the author a link to a Wikipedia article.
export const okeanElzyFile = {
  batchcomplete: "",
  query: {
    pages: {
      "161669899": {
        pageid: 161669899,
        ns: 6,
        title: "File:OkeanElzi25.jpg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/5/56/OkeanElzi25.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:OkeanElzi25.jpg",
            extmetadata: {
              Artist: {
                value:
                  '<bdi><a href="https://en.wikipedia.org/wiki/en:Alexander_Khanin" class="extiw" title="w:en:Alexander Khanin"><span title="photographer">Alexander Khanin</span></a></bdi>',
                source: "commons-desc-page",
              },
              LicenseShortName: { value: "CC BY-SA 4.0", source: "commons-desc-page" },
              AttributionRequired: { value: "true", source: "commons-desc-page" },
            },
          },
        ],
      },
    },
  },
};

// RadioheadO2211125 composite.jpg: the author a link to another site.
export const radioheadFile = {
  batchcomplete: "",
  query: {
    pages: {
      "179695193": {
        pageid: 179695193,
        ns: 6,
        title: "File:RadioheadO2211125 composite.jpg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/RadioheadO2211125_composite.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:RadioheadO2211125_composite.jpg",
            extmetadata: {
              Artist: {
                value:
                  '<a rel="nofollow" class="external text" href="https://www.flickr.com/photos/raph_ph/">Raph_PH</a>',
                source: "commons-desc-page",
              },
              LicenseShortName: { value: "CC BY 4.0", source: "commons-desc-page" },
              AttributionRequired: { value: "true", source: "commons-desc-page" },
            },
          },
        ],
      },
    },
  },
};

// The preferred image of Kalush Orchestra: a link with text after it.
export const kalushOrchestraFile = {
  batchcomplete: "",
  query: {
    pages: {
      "147909838": {
        pageid: 147909838,
        ns: 6,
        title:
          "File:- EU2024BE Informal meeting of EU Affairs Ministers BOZAR JNZT 0103 (53687141247).jpg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/-_EU2024BE_Informal_meeting_of_EU_Affairs_Ministers_BOZAR_JNZT_0103_%2853687141247%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:-_EU2024BE_Informal_meeting_of_EU_Affairs_Ministers_BOZAR_JNZT_0103_(53687141247).jpg",
            extmetadata: {
              Artist: {
                value:
                  '<a rel="nofollow" class="external text" href="https://www.flickr.com/people/199745783@N03">Belgian Presidency of the Council of the EU 2024</a> from Belgium',
                source: "commons-desc-page",
              },
              LicenseShortName: { value: "CC BY 2.0", source: "commons-desc-page" },
              AttributionRequired: { value: "true", source: "commons-desc-page" },
            },
          },
        ],
      },
    },
  },
};

// Pink Floyd, 1971 (HQ).jpg: the author plain text, the licence Public domain.
export const pinkFloydFile = {
  batchcomplete: "",
  query: {
    pages: {
      "173258503": {
        pageid: 173258503,
        ns: 6,
        title: "File:Pink Floyd, 1971 (HQ).jpg",
        imagerepository: "local",
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Pink_Floyd%2C_1971_%28HQ%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Pink_Floyd,_1971_(HQ).jpg",
            extmetadata: {
              Artist: { value: "Capitol Records", source: "commons-desc-page" },
              LicenseShortName: { value: "Public domain", source: "commons-desc-page" },
              AttributionRequired: { value: "false", source: "commons-desc-page" },
            },
          },
        ],
      },
    },
  },
};

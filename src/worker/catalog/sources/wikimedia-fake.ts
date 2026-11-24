// A Wikimedia fake with fixed data, mounted among the test hooks so that the `local` Worker calls
// it for artists' photos instead of Wikidata and Wikimedia Commons (wrangler.jsonc). Under
// /wikidata it answers wbgetclaims for the P18 images of the artists the MusicBrainz fake links
// to, with Wikidata's own answers of 2026-11-24, and under /commons a file's image info, and the
// file itself through Special:FilePath, for the browser. Alice Cooper's entity, Q332032, fails, as
// Wikimedia does when it is down; the 1960s UK Nirvana's, Q1855965, has no image.
import { Hono } from "hono";
import {
  kalushOrchestraClaims,
  kalushOrchestraFile,
  nirvanaUkClaims,
  okeanElzyClaims,
  okeanElzyFile,
  pinkFloydClaims,
  pinkFloydFile,
  radioheadClaims,
  radioheadFile,
} from "../../../shared/test-data/wikimedia";

// The P18 claims of each entity the fake has.
const claims: Record<string, unknown> = {
  Q1008489: okeanElzyClaims,
  Q80808767: kalushOrchestraClaims,
  Q44190: radioheadClaims,
  Q2306: pinkFloydClaims,
  Q1855965: nirvanaUkClaims,
};

// The entity whose calls fail.
export const failingWikidataEntity = "Q332032";

// The image info of each file the fake has, by its name as P18 gives it.
const files: Record<string, unknown> = {
  "OkeanElzi25.jpg": okeanElzyFile,
  "- EU2024BE Informal meeting of EU Affairs Ministers BOZAR JNZT 0103 (53687141247).jpg":
    kalushOrchestraFile,
  "RadioheadO2211125 composite.jpg": radioheadFile,
  "Pink Floyd, 1971 (HQ).jpg": pinkFloydFile,
};

export const wikimediaFake = new Hono();

wikimediaFake.get("/wikidata/w/api.php", (c) => {
  const entity = c.req.query("entity") ?? "";
  if (entity === failingWikidataEntity) return c.text("Service Unavailable", 503);
  const found = claims[entity];
  if (found) return c.json(found);
  return c.json({
    error: { code: "no-such-entity", info: `Could not find an entity with the ID "${entity}".` },
  });
});

wikimediaFake.get("/commons/w/api.php", (c) => {
  const title = c.req.query("titles") ?? "";
  const found = files[title.replace(/^File:/, "")];
  if (found) return c.json(found);
  return c.json({
    batchcomplete: "",
    query: { pages: { "-1": { ns: 6, title, missing: "", imagerepository: "" } } },
  });
});

// A photo, as Commons' image stands in for it here: wider than it is tall, as groups' photos are.
const photoImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 5 3">' +
  '<rect width="5" height="3" fill="#777"/></svg>';

wikimediaFake.get("/commons/wiki/Special:FilePath/:file", (c) => {
  if (!(c.req.param("file") in files)) return c.text("Not Found", 404);
  return c.body(photoImage, 200, { "Content-Type": "image/svg+xml" });
});

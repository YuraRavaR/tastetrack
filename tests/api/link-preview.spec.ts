import { expect, test } from "../support/fixtures";

// The card a link to the app shows in a messenger, from the Open Graph tags every page's <head>
// holds. A Share Link's page puts its List's card in their place (share-links.spec.ts).

// The tags that make the card, in the order they appear.
function cardTags(html: string): string[] {
  return (
    html.match(/<meta (?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g) ?? []
  );
}

test("every page of the app has a card for messengers, with its image at production's URL", async ({
  request,
}) => {
  const description = "Keep track of the films you want to watch and the ones you've seen.";
  const pages = ["/", "/saved/films/watchlist"];

  for (const path of pages) {
    const html = await (await request.get(path)).text();

    expect(cardTags(html), path).toEqual([
      `<meta name="description" content="${description}" />`,
      '<meta property="og:title" content="TasteTrack" />',
      `<meta property="og:description" content="${description}" />`,
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="TasteTrack" />',
      '<meta property="og:image" content="https://tastetrack.tastetrackravar.workers.dev/og-image.png" />',
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta property="og:image:alt" content="TasteTrack: Your taste, on the record" />',
      '<meta name="twitter:card" content="summary_large_image" />',
    ]);
  }
});

test("the card's image is served as a PNG, not as the app's page", async ({ request }) => {
  const response = await request.get("/og-image.png");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

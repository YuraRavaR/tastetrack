// Share Link pages, /s/:token: the app's own HTML with the shared List named in its <head>, so a
// link pasted into a messenger such as Telegram or Viber shows a preview card (ADR-0008). The
// page itself is the client-rendered app, which loads the List from the API. Every share page is
// noindex; one for a token that is unknown, revoked or replaced is the same plain 404 whichever
// it is.
import type { Context } from "hono";
import { Hono } from "hono";
import { type AppEnv, withDatabase } from "./env";
import { type SharedListHead, sharedListHead, shareLinkOf } from "./lists/share-links";

const siteName = "TasteTrack";

const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Text made safe to put in HTML, as element content or a quoted attribute.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => escapes[char] ?? char);
}

function meta(attribute: "name" | "property", key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;
}

const noindex = meta("name", "robots", "noindex");

// The tags that name the List for search engines, which are told to stay away, and for preview
// cards, which follow Open Graph.
function headTags(head: SharedListHead, url: string): string {
  const description = head.description
    ? [
        meta("name", "description", head.description),
        meta("property", "og:description", head.description),
      ]
    : [];
  return [
    noindex,
    ...description,
    meta("property", "og:title", head.title),
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", siteName),
    meta("property", "og:url", url),
  ].join("");
}

// The app's HTML, as the static assets serve it for any page.
function appHtml(c: Context<AppEnv>): Promise<Response> {
  return c.env.ASSETS.fetch(new URL("/", c.req.url));
}

// The app's HTML with `title` and `tags` in place, under `status`. Not cached anywhere, since a
// link can be revoked at any time.
function page(shell: Response, status: number, tags: string, title?: string): Response {
  let rewriter = new HTMLRewriter().on("head", {
    element(head) {
      head.append(tags, { html: true });
    },
  });
  if (title !== undefined) {
    rewriter = rewriter.on("title", {
      element(element) {
        element.setInnerContent(escapeHtml(title), { html: true });
      },
    });
  }
  return new Response(rewriter.transform(shell).body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

async function notFound(c: Context<AppEnv>): Promise<Response> {
  return page(await appHtml(c), 404, noindex);
}

export const sharePage = new Hono<AppEnv>();

sharePage.use(withDatabase);

sharePage.get("/s/:token", async (c) => {
  const token = c.req.param("token");
  const [head, shell] = await Promise.all([sharedListHead(c.var.db, token), appHtml(c)]);
  if (!head) return page(shell, 404, noindex);
  const { url } = shareLinkOf(token, new URL(c.req.url).origin);
  return page(shell, 200, headTags(head, url), head.title);
});

sharePage.notFound(notFound);

import { drizzle } from "drizzle-orm/d1";
import { app } from "./app";
import { refreshCache } from "./catalog/cache-refresh";
import { tmdbConfig } from "./env";
import { sharePage } from "./share-page";

// The Worker runs only for the API and Share Link pages (wrangler.jsonc); the static assets
// serve every other path. The Cron Trigger keeps the TMDB cache fresh.
export default {
  fetch(request, env, ctx) {
    const handler = new URL(request.url).pathname.startsWith("/s/") ? sharePage : app;
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller, env) {
    const run = await refreshCache(
      drizzle(env.DB),
      tmdbConfig(env),
      new Date(controller.scheduledTime),
    );
    console.log("TMDB cache refresh", run);
  },
} satisfies ExportedHandler<Env>;

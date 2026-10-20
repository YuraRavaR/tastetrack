import { app } from "./app";
import { sharePage } from "./share-page";

// The Worker runs only for the API and Share Link pages (wrangler.jsonc); the static assets
// serve every other path.
export default {
  fetch(request, env, ctx) {
    const handler = new URL(request.url).pathname.startsWith("/s/") ? sharePage : app;
    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

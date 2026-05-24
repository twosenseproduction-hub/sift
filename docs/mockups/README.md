# HTML mockups

Static exploration files for product and visual direction—not the live React app.

## Zen sift flow (`zen-sift-flow.html`)

During local development (`npm run dev` from the repo root), open:

**http://localhost:5173/mockups/zen-sift-flow.html**

## Zen sift flow v2 (`zen-sift-flow-v2.html`) — interactive mock

SPA-style panels (same visual language as v1): bottom nav + top jumps, composer draft + strip dismiss in **`sessionStorage`**, and continuity toasts between screens.

During local development, open:

**http://localhost:5173/mockups/zen-sift-flow-v2.html**

The server defaults to port **5173** in development (`server/index.ts`); if you use `PORT`, substitute that port in the URLs above.

The served copies live under `client/public/mockups/` (e.g. `zen-sift-flow.html`, `zen-sift-flow-v2.html`) and are copied into `dist/public` by Vite when you build. The path under `docs/mockups/` is a symlink for `zen-sift-flow.html` so this doc tree still points at that file.

After `npm run build` and `npm run start`, the same `/mockups/*.html` paths are served from Express static (e.g. **http://localhost:5000/mockups/zen-sift-flow-v2.html** when `PORT` is unset).

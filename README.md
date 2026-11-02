# EVO — Environment Operations

Phone-first PWA for logging weather, settling-pond water quality and coagulant stock.
Stack: Cloudflare Workers + Hono + D1 (API), React + Vite PWA (web). Spec: `docs/superpowers/specs/`.

## Setup
```
npm install
npx wrangler d1 create evo            # copy database_id into apps/api/wrangler.jsonc
cd apps/api
npx wrangler d1 migrations apply evo --local     # use --remote for production
npx tsx scripts/seed-admin.ts you@example.com 'a-long-password'   # add --remote for production
```

## Develop
```
npm run build -w @evo/web             # API serves apps/web/dist
cd apps/api && npx wrangler dev       # http://localhost:8787
npm run dev -w @evo/web               # optional: Vite on :5173, proxies /api to :8787
```
After first login as admin: add ponds, set pH/TSS limits, add users.

## Test
```
npm test
```

## Deploy
```
npm run build -w @evo/web
cd apps/api && npx wrangler d1 migrations apply evo --remote && npx wrangler deploy
```
The one Worker serves the API under `/api` and the built PWA for every other path.

## Security note
The login route has no built-in attempt limit. Before field use, add a Cloudflare rate-limiting rule for `POST /api/auth/login` in the dashboard.

## Not in this version
Event calendar, evidence camera with GPS, offline data queue, dashboard charts, Excel/PDF export. Offline now means the app shell opens without signal; saving needs a connection.

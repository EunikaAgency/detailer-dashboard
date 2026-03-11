# Otsuka Detailer Repo Guide

## Purpose
This repository is the main web/backend project for Otsuka Detailer / One Detailer.

It contains:
- the Next.js admin dashboard and API backend
- the browser PWA source and build flow
- the route that serves the PWA from the main app
- the route that serves the separate Capacitor app build
- operational scripts for database, deployment, asset sync, and security reporting

If a future Codex session needs project context, start here.

## Repo Layout
- `app/`: Next.js App Router pages, API routes, and file-serving routes
- `lib/`: backend helpers such as auth, DB, conversion, API access, and product image rewriting
- `models/`: Mongoose schemas
- `scripts/`: admin, sync, reporting, and push helpers
- `pwa/`: source-of-truth for the browser PWA
- `app-capacitor/`: separate git submodule for the Capacitor app
- `public/uploads/`: uploaded and converted media used by products
- `public/pwa/`: generated PWA build output, served by Next.js, not source-of-truth

## App Roles

### 1. Main Next.js app
The main app is the system backbone.

It provides:
- admin UI at `/dashboard/**`
- login and cookie session handling
- product CRUD and media upload/conversion
- users and offline credential issuance
- activity ingestion and reports
- file serving for uploaded assets
- hosting for the built PWA and Capacitor web bundle

Main files:
- [app](/var/public/otsukadetailer/detailer/web/app)
- [lib](/var/public/otsukadetailer/detailer/web/lib)
- [models](/var/public/otsukadetailer/detailer/web/models)

### 2. Browser PWA
The PWA source lives in [pwa](/var/public/otsukadetailer/detailer/web/pwa).

It is a standalone frontend app that is built with Vite, then emitted into `public/pwa`, and then served through the Next route:
- [app/pwa/[[...slug]]/route.js](/var/public/otsukadetailer/detailer/web/app/pwa/[[...slug]]/route.js)

Important rule:
- edit `pwa/**`
- do not hand-edit `public/pwa/**`

### 3. Capacitor app
The Capacitor app is not ordinary source inside this repo. It is a separate git repository tracked here as a submodule:
- [app-capacitor](/var/public/otsukadetailer/detailer/web/app-capacitor)
- [.gitmodules](/var/public/otsukadetailer/detailer/web/.gitmodules)

Its built web assets are served by the main Next app through:
- [app/app-capacitor/[[...segments]]/route.js](/var/public/otsukadetailer/detailer/web/app/app-capacitor/[[...segments]]/route.js)

Important rule:
- changes inside `app-capacitor/` require commits in the submodule repo
- then commit the updated submodule pointer in this parent repo if needed

## How The Apps Interact

### Shared backend
Both the PWA and the Capacitor app depend on the main Next.js backend for data and auth.

Key shared APIs:
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/products`
- `POST /api/login-events`
- `GET /api/mobile-config`

Key asset route:
- `/uploads/**` served by [app/uploads/[...segments]/route.js](/var/public/otsukadetailer/detailer/web/app/uploads/[...segments]/route.js)

### Product data flow
The source of product data is the main backend.

Flow:
1. Admin manages products in `/dashboard/products`.
2. Media uploads are stored under `public/uploads`.
3. PDF/PPT/PPTX files are converted into image sequences by the conversion worker.
4. `GET /api/products` returns normalized product payloads for clients.
5. PWA and Capacitor clients consume that same API.
6. Media URLs returned by the API are then loaded via `/uploads/**`.

Relevant files:
- [app/api/products/route.js](/var/public/otsukadetailer/detailer/web/app/api/products/route.js)
- [lib/conversionWorker.js](/var/public/otsukadetailer/detailer/web/lib/conversionWorker.js)
- [lib/fileConverter.js](/var/public/otsukadetailer/detailer/web/lib/fileConverter.js)
- [lib/productImageLibrary.js](/var/public/otsukadetailer/detailer/web/lib/productImageLibrary.js)

### Auth flow
The main dashboard uses cookie auth.
Mobile-style clients may also use bearer-based access.

Login route details:
- supports email or username login
- supports offline/keygen credential login
- issues access and refresh cookies for dashboard/browser use

Relevant files:
- [app/login/page.js](/var/public/otsukadetailer/detailer/web/app/login/page.js)
- [app/api/auth/login/route.js](/var/public/otsukadetailer/detailer/web/app/api/auth/login/route.js)
- [lib/auth.js](/var/public/otsukadetailer/detailer/web/lib/auth.js)
- [lib/offlineCredential.js](/var/public/otsukadetailer/detailer/web/lib/offlineCredential.js)

### Activity/reporting flow
The PWA and other clients can upload session/activity batches to the backend.

Flow:
1. client records local events
2. client posts to `POST /api/login-events`
3. backend stores grouped activity in `ActivityLog`
4. dashboard reads those logs in `/dashboard/logins` and `/dashboard/reports`

Relevant files:
- [app/api/login-events/route.js](/var/public/otsukadetailer/detailer/web/app/api/login-events/route.js)
- [models/ActivityLog.js](/var/public/otsukadetailer/detailer/web/models/ActivityLog.js)
- [models/LoginEvent.js](/var/public/otsukadetailer/detailer/web/models/LoginEvent.js)

### Mobile config flow
The backend can return branding/text config per account:
- [app/api/mobile-config/route.js](/var/public/otsukadetailer/detailer/web/app/api/mobile-config/route.js)

This is meant for mobile/PWA client text and image customization, not the dashboard UI.

## Important Routes

Dashboard and web:
- `/`
- `/login`
- `/dashboard`
- `/dashboard/products`
- `/dashboard/users`
- `/dashboard/logins`
- `/dashboard/reports`
- `/dashboard/settings`

Hosted client apps:
- `/pwa/**`
- `/app-capacitor/**`

APIs commonly touched:
- `/api/auth/**`
- `/api/products`
- `/api/users`
- `/api/login-events`
- `/api/mobile-config`
- `/api/reports/**`

## Build And Deploy Workflow

### Main app
The root build runs both the PWA build and the Next.js build:

```bash
npm run build
```

That currently means:
1. `npm --prefix ./pwa run build`
2. `next build --webpack`

### PWA
Source-of-truth is `pwa/**`.

Typical workflow:
```bash
npm --prefix ./pwa install
npm --prefix ./pwa run build
```

The root app build also runs the PWA build automatically.

### Production process manager
PM2 apps are defined in:
- [ecosystem.config.js](/var/public/otsukadetailer/detailer/web/ecosystem.config.js)

Important process names:
- `detailer-web-prod`
- `detailer-web-dev`
- `detailer-conversion-cron`

Useful commands:
```bash
pm2 status
pm2 restart detailer-web-prod
```

Production web details:
- app root: `/var/public/otsukadetailer/detailer/web`
- prod port: `7001`
- dev port: `7000`

## Git And Remote Topology

### Parent repo
Current branch:
- `main`

Configured remotes:
- `origin`
- `eunika`

Helper script:
- [scripts/push-both.sh](/var/public/otsukadetailer/detailer/web/scripts/push-both.sh)

Use it to push `main` to both remotes:
```bash
bash scripts/push-both.sh main
```

### Capacitor submodule
Submodule path:
- `app-capacitor`

Tracked branch:
- `live`

If you change `app-capacitor/`:
1. commit inside `app-capacitor`
2. push its own repo/branch
3. commit the updated submodule pointer in the parent repo if the parent should reference the new revision

## Operational Scripts
See:
- [scripts/README.md](/var/public/otsukadetailer/detailer/web/scripts/README.md)

Common scripts:
- `npm run reset-admin`
- `npm run reset-admin:prod`
- `npm run sync-db`
- `npm run sync-db:preview`
- `npm run export-db:live`
- `npm run import-db:live`

Security/reporting docs:
- [scripts/SECURITY_AUDIT.md](/var/public/otsukadetailer/detailer/web/scripts/SECURITY_AUDIT.md)

## Editing Guardrails
- Prefer editing source app folders, not generated output folders.
- For PWA work, edit `pwa/**`, not `public/pwa/**`.
- For Capacitor work, edit inside `app-capacitor/**` and treat it as its own repo.
- Do not commit `node_modules`, Playwright traces, copied upload dumps, or other generated artifacts.
- If you change auth, product payloads, login event ingestion, or conversion logic, verify the dependent clients still work.

## Fast Mental Model
- Next.js app is the backend and admin shell.
- `pwa/` is a client app that the backend builds and serves.
- `app-capacitor/` is a separate client repo that the backend serves from its built `dist`.
- `/api/products` and `/uploads/**` are the main shared content interfaces.
- `/api/login-events` is the shared activity ingestion path.
- PM2 `detailer-web-prod` is the production process to restart after deployment.

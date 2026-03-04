# Web AGENT Guide

## Scope
This app is the Next.js admin/API backend for Otsuka Detailer. It handles authentication, product/media management, offline credential issuance, activity ingestion, and reporting.

## Tech Stack
- Next.js App Router (`app/**`) + React 19
- MongoDB via Mongoose (`lib/db.js`, `models/**`)
- Auth: JWT access/refresh cookies + optional bearer token
- Charts: `chart.js` + `react-chartjs-2`
- File conversion: LibreOffice + `pdf2pic` with `pdftoppm` fallback

## App Surface (UI)
- `/` login page: accepts email or username and restores last dashboard route from `localStorage`.
- `/dashboard`: product count summary with category/brand distributions.
- `/dashboard/products`: create products, upload media, and navigate to detail pages.
- `/dashboard/products/[slug]`: edit metadata/media/thumbnail, delete media groups, edit hotspots, and poll every 10s for pending conversions.
- `/dashboard/users`: issue offline credentials, search/edit/delete reps, and optionally reissue keygen credentials.
- `/dashboard/logins`: session-level activity timeline explorer with pagination.
- `/dashboard/reports`: 30-day charts plus CSV/XLS exports for sessions and engagement metrics.
- `/dashboard/settings`: password-change form for current user.

## Auth and Session Model
- `lib/auth.js` cookie model: access cookie `token` (15m), refresh cookie `refreshToken` (30d).
- `requireAuth` accepts cookie token or bearer token.
- If access token invalid and request was cookie-based, refresh token fallback is attempted.
- Login route (`/api/auth/login`) supports password auth (`bcrypt`) and keygen credential auth (`lib/offlineCredential`), then issues both cookies.

## Offline Credential System
- Implemented in `lib/offlineCredential.js`.
- Supported formats: short credential (`od-offline-v4-short`), encrypted credential (`ode1.`), and legacy JWT credential.
- Secret source: `OFFLINE_CREDENTIAL_SECRET` (preferred), fallback `JWT_SECRET`.
- Pending issuance flow: `PendingCredential` stores hashed issued credentials and identity data before first successful keygen login.

## API Surface
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/change-password`.
- Users: `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`.
- Products/media: `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`, `POST /api/products/:id/media`.
- Product read contract: `GET /api/products` returns `{ version, products }`, grouped media, and allows API-key-based access.
- Conversion: `POST /api/conversion/worker`, plus standalone `POST /api/convert-pdf` and `POST /api/convert-ppt`.
- Activity/reports: `POST /api/login-events`, `GET /api/login-events`, `GET /api/reports/sessions-daily`, `GET /api/reports/engagement-summary`.
- Mobile UI config: `GET /api/mobile-config` (returns account-scoped text config for mobile placeholders).
- Other secured resources: `GET /api/doctors`, `GET /api/appointments`.

## Conversion Pipeline
- Product uploads with PDF/PPT/PPTX are queued into `public/uploads/queue`.
- `lib/conversionWorker` processes one queued file at a time, converts to images under `public/uploads/converted/<group>/images`, updates `Product.media`, and removes queue files.
- Worker execution paths: in-process timer side effect and explicit endpoint trigger (`/api/conversion/worker`, including cron flow).
- `lib/fileConverter.js` conversion flow: PPT/PPTX -> PDF (LibreOffice/soffice) -> images; PDF -> images using `pdf2pic` with `pdftoppm` fallback.

## Data Models (Key)
- `User`: identity fields + hashed `password` + `keygen` + `keygenIssuedAt`
- `PendingCredential`: staged offline credential metadata before consumption
- `Product`: metadata + media array (type/url/group/status/source/hotspots)
- `ActivityLog`: per-user per-session aggregated events (source/method/timestamps)
- `LoginEvent`: legacy event log schema (fallback for read path)
- `Doctor`, `Appointment`, `Presentation`: auxiliary domain models

## Environment Variables (Used in Code)
- Auth/security: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `OFFLINE_CREDENTIAL_SECRET`, `API_KEY`.
- DB/runtime: `MONGO_URI`, `APP_ENV`, `NEXT_PUBLIC_APP_ENV`, `VERCEL_ENV`.
- Conversion: `CONVERSION_WORKER_INTERVAL_MS`, `CONVERSION_CRON_SECRET`, `CONVERSION_TIMEOUT_MS`, `CONVERSION_DENSITY`, `CONVERSION_WIDTH`, `CONVERSION_HEIGHT`.

## Operational Scripts
- `npm run reset-admin` / `npm run reset-admin:prod`
- `npm run sync-db`, `npm run sync-db:preview`, `npm run sync-db:live-to-staging`
- `npm run export-db:staging`, `npm run export-db:live`
- PM2 process definitions are in `ecosystem.config.js` (prod/dev web + conversion cron).

## Important Implementation Notes
- `GET /api/products` has dual access mode: authenticated user OR valid API key.
- Product media deletion removes backing files and may recursively remove converted folders.
- Activity analytics depend on `events.action`, `events.screen`, `events.details` naming; changing these affects reports.
- Both legacy and current event stores exist (`LoginEvent` and `ActivityLog`); read API falls back when needed.
- Conversion stack depends on system binaries (LibreOffice, plus gm/convert or pdftoppm path).

## Change Checklist
- Auth changes: verify cookie login/logout, refresh flow, and bearer-token behavior.
- Users/credentials changes: verify issuance, pending-credential consumption, and reissue behavior.
- Product/media changes: verify upload, queue-to-conversion, hotspot persistence, and delete cleanup.
- Activity/reporting changes: verify `/api/login-events` ingestion and report/chart integrity.
- Infra/runtime changes: verify worker schedule, cron-secret gate, and staging/production environment parity.

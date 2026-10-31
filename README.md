# Plugg Admin — standalone frontend

This is an independently editable React/Vite frontend. It contains no database connection, database password, server function imports, or copied backend. The main Plugg backend remains responsible for authentication, role checks, SQL, media authorization and audit logging.

## Run locally

1. In `/home/prwxsm/Projects/plugg`, run `npm run dev -- --host 127.0.0.1 --port 3000` with its existing server `.env`.
2. In this directory, run `npm install` (first setup), then `npm run dev`.
3. Open http://localhost:3001/admin. Use your existing Plugg staff account.

Optional: copy `.env.example` to `.env.local` to change the backend proxy target or public main-site link. Do not put database credentials in this project. `PLUGG_BACKEND_URL` is server-only; `VITE_PLUGG_SITE_URL` is intentionally public.

`npm run build` type-checks and produces `dist/`. `npm run preview` previews the build with the API proxy. The main application must still be running because the database and operational backend remain there.

## Edit

- `src/components/admin/`: pages, forms, profile cards, theme and official logo integration.
- `src/lib/api.ts`: typed JSON API client.
- `src/main.tsx`: standalone routing.
- `public/admin/plugg-logo.png`: original supplied logo.

The extracted files are ordinary copies, not links to the old project's components. Future admin UI edits belong here. Existing `/admin` in the main project is retained for compatibility; it does not automatically receive these edits.

## API contract

All requests go to same-origin `/api/admin/v1/`, proxied to Plugg. Responses are JSON with `Cache-Control: private, no-store`.

| Method | Endpoint | Body |
| --- | --- | --- |
| GET | snapshot | none; returns the existing role-filtered AdminResult |
| POST | login | `{ identifier, password }` |
| POST | logout | `{}` |
| POST | operations | Existing administrative operation payload including action, targetId, reason, confirmed; staff operations require current password |
| POST | review | `{ action: "approve", releaseId, date }` or `{ action: "request_changes", releaseId, feedback }` |
| POST | retry-audio | `{ trackId }` |

Writes require `Content-Type: application/json`, `X-Plugg-Admin: 1`, and an accepted Origin. Sessions are HttpOnly, SameSite=Lax cookies, with Secure in production. No tokens are stored in localStorage. Super Admin-only staff management, final-Super-Admin protection and all existing service validations are enforced in the backend, not trusted from frontend fields. Login only issues a session for an active staff membership.

## Deploy separately

Build this project and serve `dist/` on your admin HTTPS domain. Configure SPA fallback and reverse-proxy only `/api/admin/v1/`, `/api/stream/`, `/api/file/` to the existing Plugg backend. See `deploy/nginx.conf.example`. Set backend `PLUGG_ADMIN_ORIGINS=https://your-admin-domain` and frontend `VITE_PLUGG_SITE_URL=https://your-main-domain` before building. Use HTTPS and preserve Origin and Cookie/Set-Cookie headers through the proxy. Do not expose the PostgreSQL port. No permissive CORS is needed.

The local defaults allow localhost/127.0.0.1 port 3001 only in development. The main backend can be deployed independently of this frontend. The public main app, artist dashboard and database are not moved by this extraction.

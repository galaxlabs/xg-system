# XG System Dashboard

React + Tailwind dashboard frontend for the XG / cclms Frappe bench.

What is included:
- Session-aware Frappe login handling
- Role-filtered navigation and workflow actions
- Module dashboards for leads, pipeline, attendance, projects, finance, and payroll
- Frappe asset sync for hosting inside the `cclms` bench

## Run locally

```bash
cd /home/fg/gb/apps/xg-system
npm install
cp .env.example .env.local
npm run dev
```

Default URL: `http://localhost:5173`

## Frappe connection

The dashboard prefers the logged-in Frappe session cookie when it runs on the same site as the bench. That is the safest setup for `/home/fg/gb/sites/btm.digihoopoe.com`.

If you need cross-site access for development or testing, fill in the optional token values in `.env.local`:

```bash
VITE_FRAPPE_BASE_URL=https://btm.digihoopoe.com
VITE_API_KEY=...
VITE_API_SECRET=...
```

## Build

```bash
npm run build
```

## Sync into the bench

This repo includes a helper that copies the Vite build into the Frappe app public folder:

```bash
./scripts/sync-to-frappe-assets.sh
```

By default it syncs to:

- `/home/fg/gb/apps/cclms/cclms/public/xg-system`

After syncing, the dashboard is available at:

- `/assets/cclms/xg-system/index.html`

## Login and roles

The app checks the current Frappe session through `cclms.api.auth.whoami`.

If the user is a guest, the dashboard shows a login screen and routes them back to Frappe login. If the user is authenticated, the sidebar and workflow buttons only show modules/actions that match their assigned Frappe roles.

## Notes

- Session auth is preferred over API secrets when the app is served from the same Frappe site.
- API key/secret support remains available for local development.
- The Frappe site already has the `cclms` app installed, which exposes the reporting endpoints used by this dashboard.

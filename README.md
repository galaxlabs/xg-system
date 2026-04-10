# Galaxy UI React Dashboard

React + Tailwind dashboard frontend for Galaxy UI.

Includes:
- Modern drawer sidebar
- Module-grouped navigation
- Collapsible module dropdowns (DocTypes, Dashboards, Reports)
- Live theme/layout design controls
- Accounts module workspace (CRUD + permissions + charts + print format designer)

## Run locally

```bash
cd apps/galaxy_ui/react_dashboard
npm install
cp .env.example .env
npm run dev
```

Default URL: `http://localhost:5173`

## Build

```bash
npm run build
npm run preview
```

## Build + Ship To Frappe Assets (Plug-and-Play)

No Nginx change is required for this mode.

```bash
npm run build:frappe
```

This copies `dist/` to:
- `/home/dg/db-b/apps/galaxy_ui/galaxy_ui/public/react_dashboard`

Open:
- `/assets/galaxy_ui/react_dashboard/index.html`

Override target:

```bash
TARGET_DIR=/custom/path/react_dashboard npm run build:frappe
```

## Deploy to Vercel

1. Push this folder to your git repository.
2. In Vercel, import project and set root directory to `apps/galaxy_ui/react_dashboard`.
3. Build command: `npm run build`
4. Output directory: `dist`

## Connect with Galaxy UI

In Frappe `UI App Config`, set `base_urls`:

```json
{
  "react_dashboard_url": "https://your-vercel-domain.vercel.app"
}
```

Optional feature flag:

```json
{
  "react_dashboard": 1
}
```

Then open `/app/ui_panel` and click **React Dashboard**.

## Runtime Base URL Priority

The app resolves Frappe base URL in this order:
1. Query param `?frappe_base=https://your-site`
2. `VITE_FRAPPE_BASE_URL` from `.env`
3. `window.location.origin`
# react_dashboard

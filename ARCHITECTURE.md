# QGuard Helix Architecture

QGuard Helix is a React + Vite frontend with an Express API backend.

## Runtime Boundaries

- `src/main.tsx`, `src/App.tsx`, and `src/app/**` contain the browser application.
- `src/api-server/**` contains the active backend API.
- Vite mounts the Express API during development through `vite.config.ts`.
- `src/api-server/standalone.ts` serves the built Vite app and Express API from one Node process for deliberate single-service deployments.
- `src/app/api/**/route.ts` files are legacy Next-style route files. They are not served by Vite and should not be used as the active backend path.

## Data And Security

- Supabase remains the auth, database, storage, and realtime layer.
- Browser code calls `/api/v1/**` for sensitive writes and server-owned operations.
- Express creates Supabase clients with the authenticated user's JWT so RLS still protects user-owned data.
- Supabase Realtime and Express SSE provide live telemetry.
- User-owned tables should keep RLS enabled with `auth.uid() = user_id` policies.

## Local Development

- `npm run dev` runs Vite on port `3000` and mounts Express under `/api/v1`.
- API health is available at `/api/v1/health`.
- Dashboard/profile/module endpoints are implemented in `src/api-server`.

## Production Options

- Static frontend plus separate Node API service: build the Vite app and deploy `src/api-server` as its own Node service/API gateway target.
- Single Node service: run `npm run build`, then `npm start` to serve both `dist/` and `/api/v1/**`.

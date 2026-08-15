# Deploying a demo on free tiers only (no credit card)

Every VPS/cloud provider (Oracle, AWS, GCP, Azure, DigitalOcean, ...) asks
for a card even on its free tier, as an anti-abuse gate. This path avoids
that entirely by stitching together separately-hosted, genuinely
card-free managed free tiers instead of one box running
`docker-compose.prod.yml`:

| Piece | Service | Why |
|---|---|---|
| Postgres + PostGIS | [Supabase](https://supabase.com) free tier | No card; PostGIS is a one-click extension |
| Neo4j | [Neo4j AuraDB Free](https://neo4j.com/cloud/aura-free/) | No card; official managed free tier |
| API | [Render](https://render.com) free Web Service | No card; deploys straight from `apps/api/Dockerfile` |
| Frontend | Render free Static Site | No card; no cold-start (only the API sleeps) |

I haven't run through the Render/Supabase/Aura dashboards myself in this
session (no account access) — the steps below are accurate as of how
each product works, but exact field names in their UIs may drift; adapt
as needed if a screen looks different.

**Free-tier tradeoffs, worth knowing going in:**
- Render's free web service **sleeps after 15 minutes idle** and takes
  ~30-60s to wake on the next request. Fine for an occasional-use demo,
  will read as "broken" if someone hits it expecting instant response.
- Render's free web service disk is **ephemeral** — anything written to
  `ATTACHMENT_STORAGE_PATH` (case attachment uploads) is wiped on every
  restart/redeploy. Uploaded attachments will not survive a sleep/wake
  cycle in practice. Fine for a demo; not fine for anything real.
- Supabase and Aura free tiers both have storage/size caps generous
  enough for demo data, not for real caseloads.

## 1. Neo4j AuraDB Free

1. neo4j.com/cloud/aura-free → create a free instance.
2. Save the generated password immediately — Aura only shows it once.
   You'll get a `neo4j+s://<id>.databases.neo4j.io` URI.

## 2. Supabase (Postgres + PostGIS)

1. supabase.com → New Project (free tier).
2. Project Settings → Database → copy the connection string
   (`postgresql://postgres:<password>@<host>:5432/postgres` — use the
   "Session pooler" or direct connection string, not the transaction
   pooler, since Alembic needs a normal session).
3. SQL Editor → run:
   ```sql
   create extension if not exists postgis;
   ```
   The app's models use PostGIS geometry columns from the very first
   migration — this has to happen before you run migrations, and it's
   not something the migration does for you (the dev Docker image has
   it pre-enabled, Supabase doesn't).

## 3. Run migrations and seed, from your machine

No compute host has a shell you need for this — reuse the API's own
Docker image (already built locally) as a disposable one-off container
against the remote databases:

```bash
cd /path/to/Crime_analytics

docker run --rm \
  -e DATABASE_URL="postgresql+psycopg2://postgres:<password>@<supabase-host>:5432/postgres" \
  crime_analytics-api alembic upgrade head

# Demo data, same scripts as local dev — skip if loading real content instead
docker run --rm \
  -e DATABASE_URL="postgresql+psycopg2://postgres:<password>@<supabase-host>:5432/postgres" \
  -e NEO4J_URI="neo4j+s://<id>.databases.neo4j.io" \
  -e NEO4J_USER="neo4j" \
  -e NEO4J_PASSWORD="<aura-password>" \
  crime_analytics-api python -m scripts.seed_dev_data
# ...repeat for seed_phase4_test_data, seed_phase4_relationships,
# seed_phase6_priority, seed_phase6_merge (same order as docs/deployment.md)
```

(`crime_analytics-api` is the image name `docker compose build` already
produced locally — check `docker images` if it's named differently.)

## 4. API on Render

New → Web Service → connect the repo.

- **Runtime**: Docker
- **Root Directory**: `apps/api` (so the existing `Dockerfile` is found directly)
- **Instance Type**: Free
- **Health Check Path**: `/health`
- **Environment variables** (Render dashboard, not a committed file):
  ```
  DATABASE_URL=postgresql+psycopg2://postgres:<password>@<supabase-host>:5432/postgres
  NEO4J_URI=neo4j+s://<id>.databases.neo4j.io
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=<aura-password>
  JWT_SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
  ENVIRONMENT=staging
  CORS_ORIGINS=https://<your-render-static-site>.onrender.com
  ```
  (`CORS_ORIGINS` you'll only know for certain after step 5 creates the
  static site's URL — come back and set it once you have that URL, since
  it must match exactly: scheme + host, no path, no trailing slash.)
- Free-tier RAM is 512MB — the Dockerfile's default `CMD` doesn't set a
  worker count explicitly at the image level, but if you override the
  start command, keep it to a single worker (`--workers 1`) rather than
  the `--workers 2` used in the VPS runbook, to leave headroom.
- If Render's health check can't reach the container on port 8000: the
  Dockerfile already `EXPOSE`s and the `CMD` binds 8000, which Render's
  Docker runtime should auto-detect; if it doesn't, override the start
  command in the dashboard to
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` so it
  binds whatever port Render actually assigns.

Note the deployed URL, e.g. `https://cip-api.onrender.com`.

## 5. Frontend on Render

New → Static Site → connect the same repo.

- **Root Directory**: `apps/web`
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `apps/web/dist`
- **Environment variable**: `VITE_API_BASE_URL=https://cip-api.onrender.com/api/v1`
  (the API URL from step 4, with `/api/v1` appended — this is a
  build-time variable, `apps/web/src/services/client.ts` reads it via
  `import.meta.env.VITE_API_BASE_URL`)

`apps/web/public/_redirects` (`/*  /index.html  200`) is already in the
repo — Render's static-site build copies it into `dist/` automatically,
which is what makes deep links like `/cases/<id>` work on refresh
instead of 404ing (this is a single-page app using real browser history
routing, not hash routing).

Once this deploys, go back to step 4 and set the API's `CORS_ORIGINS` to
this static site's actual URL, then redeploy the API for it to take
effect.

## 6. Smoke test

```bash
curl https://cip-api.onrender.com/health   # {"status":"ok",...} — first hit may be slow (cold start)
```

Open the static site's URL, log in with a seeded account (same
credentials as docs/deployment.md §3), confirm the district map and a
case load. Expect the first request after any idle period to be slow.

## Updating

Render redeploys automatically on push to the connected branch by
default (check this is set to the branch you intend). Re-run the
Alembic `docker run` command from step 3 by hand after any migration
lands — Render doesn't run it for you.

## When you're ready to move off free tiers

`docker-compose.prod.yml` + `docs/deployment.md` is still the intended
path once a card/VPS budget is available — same app, same env vars,
just co-located instead of split across four providers, and without the
sleep/ephemeral-disk tradeoffs above.

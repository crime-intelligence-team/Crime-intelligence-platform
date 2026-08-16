# Deploying a staging/demo environment

This stands up an internet-reachable copy of the platform for internal
review — not hardened for real case data (see "Before this holds real
data" at the end). Target: one VPS running Docker Compose, `docker-compose.prod.yml`
at the repo root, fronted by Caddy for automatic HTTPS.

No card/VPS budget available right now? See
[deployment-free-tier.md](deployment-free-tier.md) for the same app split
across free managed tiers (Render + Supabase + Neo4j Aura) instead —
come back to this doc later when a VPS is an option.

## Prerequisites

- A VPS with Docker + Compose v2 installed, 4GB+ RAM (Postgres + Neo4j +
  API together are the floor; Neo4j alone wants ~2GB).
- Ports 80 and 443 open inbound (only these — see "Firewall" below).
- Optional but recommended: a domain/subdomain with an A record pointing
  at the VPS's IP, so Caddy can provision a real Let's Encrypt certificate.
  Without one you can still deploy over plain HTTP to the bare IP.

## 1. Clone and generate secrets

```bash
git clone <repo-url> && cd Crime_analytics

cp .env.prod.example .env
cp apps/api/.env.prod.example apps/api/.env
```

Generate two independent secrets and a JWT signing key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # run 3x
```

Fill in:

- `.env` (repo root): `POSTGRES_PASSWORD`, `NEO4J_PASSWORD`, `SITE_ADDRESS`
  (your domain, e.g. `staging.example.com`, or `http://<vps-ip>` if you
  have no domain yet).
- `apps/api/.env`: `DATABASE_URL`'s password and `NEO4J_PASSWORD` — **must
  be the same values** you just put in the root `.env` (two files because
  the app reads its own `.env`, while `docker-compose.prod.yml` reads the
  root one for Postgres/Neo4j container startup — nothing keeps them in
  sync automatically, so change both when rotating). `JWT_SECRET_KEY` gets
  its own separate secret. `CORS_ORIGINS` must exactly match the scheme
  and host the frontend will actually be served from.

## 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps   # wait for postgres/neo4j "healthy", api "healthy"
```

## 3. Migrate and seed

The prod API container doesn't bind-mount source, so run these inside the
container rather than against a host-published DB port (none is published):

```bash
docker exec cip-api alembic upgrade head

# Demo data so reviewers have something to click through — same seed
# scripts as local dev. Skip this if you're loading real content instead.
docker exec cip-api python -m scripts.seed_dev_data
docker exec cip-api python -m scripts.seed_phase4_test_data
docker exec cip-api python -m scripts.seed_phase4_relationships
docker exec cip-api python -m scripts.seed_phase6_priority
docker exec cip-api python -m scripts.seed_phase6_merge
docker exec cip-api python -m scripts.seed_demo_enrichment
```

Seeded logins (`username_or_official_id` / password): `admin`/`ADM-0001`,
`analyst`/`ANL-0001`, `officer`/`DTO-0001`, `supervisor`/`SUP-0001`,
`detective`/`DET-0001`, all `Password1!`. **Change these before giving
access to anyone outside the immediate team** — same password everywhere
is fine for a five-minute local smoke test, not for a shared demo link.

## 4. Smoke test

```bash
curl https://<your-domain>/health          # {"status":"ok",...}
```

Then open `https://<your-domain>/` in a browser, log in with a seeded
account, and confirm the district map and a case load.

## Firewall

Only 80/443 (Caddy) and SSH need to be open. `docker-compose.prod.yml`
deliberately does not publish Postgres (5432), Neo4j (7474/7687), or the
API (8000) to the host — they're reachable only from the `web`/`api`
containers over the compose network. Don't add `ports:` entries for them
without a specific reason; if you do, put them behind the firewall too.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
docker exec cip-api alembic upgrade head   # if new migrations landed
```

## Backups

Nothing here automates backups yet. At minimum, periodically:

```bash
docker exec cip-postgres pg_dump -U cip cip | gzip > cip-$(date +%F).sql.gz
```

and copy that off the box. `postgres_data`/`neo4j_data` are named Docker
volumes — `docker volume inspect` for their on-disk path if you'd rather
snapshot at the filesystem level.

## Known quirk carried over from dev

The frontend keeps its access token in memory, not `localStorage`/cookies
— a hard page reload logs the user out and redirects to `/login`. Worth
telling reviewers up front so it doesn't read as a bug; not something
this deployment setup changes.

## Before this holds real data

This is a staging/demo posture, not a production one for actual
case/subject data. At minimum, before that: move secrets out of a
plaintext `.env` on disk into a real secrets manager, put the VPS behind
your org's VPN/SSO rather than the open internet, set up real backup
automation with tested restores, and get the classification/redaction
posture (docs/decisions/999 §2, §3) reviewed by whoever owns compliance
for this data — several items on that list (e.g. attachments being a
stub, redaction covering only export + entity detail) are relevant to
that review, not just feature gaps.

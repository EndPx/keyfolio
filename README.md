# Keyfolio

**Performance in public. Strategy by invitation.**

Keyfolio lets a trader authorize access to one NEAR Confidential Intents account. Followers buy a transferable, time-limited NEAR Access NFT to read its authorized activity through a dashboard and API. Public performance is derived from reconciled account data. Assisted copy uses the follower's funds and a fresh explicit signature.

Current state: the KF-02a foundation source (`packages/domain`, `packages/api-contract`, `apps/api`, `apps/worker`) exists and passes local build/typecheck/tests. No application deployment, contract, authenticated account ingestion or end-to-end integration has been accepted. See [current status](docs/status.md) before interpreting this repository as a working product.

## Start here

- [Product baseline](docs/planning/keyfolio-v1/01-PRODUCT-AND-ENGINEERING-SPEC.md) and [acceptance matrix](docs/planning/keyfolio-v1/02-TASKS-AND-ACCEPTANCE.md)
- [Binding decisions](docs/decisions.md)
- [Architecture and authority boundaries](docs/architecture.md)
- [Database design and on-chain/off-chain placement](docs/database.md)
- [Design system](DESIGN.md)
- [Task status and evidence](docs/status.md)
- [Agent recovery instructions](AGENTS.md)

## Planned workspace

`apps/web` (Next.js), `apps/api` (Fastify), `apps/worker` (ingestion/reconciliation), `contracts/access` (Rust/near-sdk), `packages/domain` (pure rules), `packages/provider-adapter` (server-only upstream boundary), `packages/api-contract` (wire schemas/OpenAPI).

`packages/domain`, `packages/api-contract`, `apps/api` and `apps/worker` now exist (KF-02a foundation). `apps/web`, `contracts/access` and `packages/provider-adapter` are not created yet. Selected baseline: pnpm TypeScript workspace, PostgreSQL, NEAR sandbox and Playwright. Exact dependency pins are accepted only after installation/build verification.

## Local setup (KF-02a)

Runtimes are pinned to Node 24.18.0 and pnpm 10.21.0; exact package pins live in `package.json` and `pnpm-lock.yaml`.

```sh
pnpm install          # clean-checkout install
pnpm build            # emit packages/domain + packages/api-contract dist, compile apps
pnpm typecheck        # strict tsc across every package and scripts/
pnpm test             # build, then run the node:test suite (via tsx)
pnpm check            # build + typecheck + test in one command
pnpm db:migrate       # EXTERNAL: apply apps/api/migrations/0001_initial.sql to the DATABASE_URL server
pnpm db:migrate:local # explicitly local: apply the migration to an isolated ephemeral PostgreSQL (PGlite) engine
pnpm db:evidence      # print exact atomic_u128 domain SQL failures/successes (SQLSTATE codes)
```

`pnpm db:migrate` requires `DATABASE_URL` and does **not** fall back to the ephemeral engine; the ephemeral engine is reachable only through the explicitly-named `pnpm db:migrate:local`. The migration has a matching `0001_initial.down.sql` (`psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f apps/api/migrations/0001_initial.sql` / `...down.sql`).

### Modes and environment

`KEYFOLIO_MODE` is required and must be exactly `FIXTURE`, `TESTNET`, or `LIVE` (see `.env.example`). There is no default and no silent fixture fallback; `TESTNET`/`LIVE` fail fast when required secrets or source configuration are missing. The fixture-only `/internal/validate-amount` seam is registered only in `FIXTURE` mode and is unreachable in `TESTNET`/`LIVE`.

Configuration is read only from the **process environment** — the apps/worker do not load `.env` automatically. Copying `.env` alone has no effect; export the variables in the shell first (POSIX):

```sh
export KEYFOLIO_MODE=FIXTURE PORT=3000
```

On Windows PowerShell use `$env:KEYFOLIO_MODE = "FIXTURE"` before the command, or prefix an inline variable on WSL/POSIX shells: `KEYFOLIO_MODE=FIXTURE pnpm run ...`.

### Run the API and worker

```sh
# API (listens on 127.0.0.1:3000 by default in FIXTURE mode)
KEYFOLIO_MODE=FIXTURE pnpm --filter @keyfolio/api start

# Health check (envelope: data / meta{request_id,observed_at,coverage,stale} / error)
curl http://127.0.0.1:3000/health

# Worker (FIXTURE = idle no-op entrypoint that exits cleanly)
KEYFOLIO_MODE=FIXTURE pnpm --filter @keyfolio/worker start
```

The worker refuses to run in `TESTNET`/`LIVE` because no source adapter is implemented in this slice; it never fakes a source or signer.

### Amount contract

Atomic amounts cross boundaries as canonical decimal-integer strings (`^(0|[1-9][0-9]*)$`, bounded by the u128 maximum); JSON numbers and fractional strings are rejected outright. The PostgreSQL schema stores them in a `TEXT` `atomic_u128` domain (never `NUMERIC(p,0)`, which can round before a CHECK runs).

## Boundaries

Account-following does not imply coverage of unrelated wallets or protocols. Upstream permissions and account-wide history remain an external gate. Backend operators process authorized plaintext data; subscribers can retain downloaded information, and public NFTs can reveal subscription relationships. NFT access does not grant trading authority. The subscription contract holds prepaid subscription liabilities; Keyfolio does not hold trader/follower trading keys.

No public paid service, audited-security claim, mainnet transaction or live performance claim is established by this repository.

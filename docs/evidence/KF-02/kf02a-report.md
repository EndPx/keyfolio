# KF-02a evidence (first bounded KF-02 slice)

- Task: KF-02a — runnable pnpm TypeScript workspace, strict AtomicAmount boundary, Fastify health service, idle fixture worker, initial PostgreSQL migration, amount/env validation tests.
- Executor: DeepSeek Harness / GATER `deepseek-v4.1-flash-1017-v2` (Orca worker). Reviewer: Codex.
- Date/zone: 2026-11-06 Asia/Jakarta.
- Workspace: repository root (local checkout; machine paths omitted), branch `main`, base commit `408b933` (docs: mark KF-02a implementation dispatched). No commit was made; Codex reviews then commits.
- Result class (this slice): **PASS_LOCAL** (fixtures + ephemeral real-PostgreSQL engine only). External-server PostgreSQL and any TESTNET/LIVE runtime remain **NOT_RUN** — this is explicitly not full KF-02 acceptance.

## Runtimes and exact pins (from npm metadata, installed)

| Package | Installed pin | Notes |
|---|---|---|
| Node | 24.18.0 | runtime |
| pnpm | 10.21.0 | `packageManager` + engines |
| typescript | 5.9.3 | (7.x exists; pinned to stable 5.x line) |
| tsx | 4.23.15 | test/run loader (esbuild-based) |
| fastify | 5.12.8 | API |
| @types/node | 24.19.2 | matches Node 24 |
| @electric-sql/pglite | 0.5.15 | WASM PostgreSQL engine for DB tests |
| pg | 8.23.1 | external DB migration path (typechecked only) |
| @types/pg | 8.23.1 | types for `pg` |

No Turbo, Redis, or provider SDK. No guessed "latest" strings; every pin resolves from npm metadata above.

## Database runtime evidence

Engine (from `pnpm db:evidence` `SELECT version()`):

```
PostgreSQL 18.6 (PGlite 0.5.15) on wasm32-unknown-emscripten, ... 32-bit
```

The migration `apps/api/migrations/0001_initial.sql` applies atomically (`BEGIN; … COMMIT;`) to an ephemeral PGlite PostgreSQL engine. It defines a `TEXT` `atomic_u128` domain (canonical regex + `length<=39` + 39-digit `COLLATE "C"` range compare), a `signed_atomic_delta` domain (rejects `-0`), a `keyfolio_network` domain, and foundation tables `source_bindings`, `ledger_events` (occurred/source_execution/observed timestamp separation), `asset_movements`, `worker_cursors` — with a reversible `0001_initial.down.sql`.

Direct SQL results capturing the exact SQLSTATE (all CHECK violations = `23514`):

| Statement | Outcome | SQLSTATE |
|---|---|---|
| `SELECT '0'::atomic_u128` | OK | — |
| `SELECT '1'::atomic_u128` | OK | — |
| `SELECT '340282366920938463463374607431768211455'::atomic_u128` | OK | — |
| `SELECT '1.5'::atomic_u128` | ERROR | 23514 (check "atomic_u128_is_canonical") |
| `SELECT 1.5::atomic_u128` (numeric literal) | ERROR | 23514 (check "atomic_u128_is_canonical") |
| `SELECT 1.0::atomic_u128` | ERROR | 23514 (check "atomic_u128_is_canonical") |
| `SELECT '01'::atomic_u128` | ERROR | 23514 |
| `SELECT '-1'::atomic_u128` | ERROR | 23514 |
| `SELECT '+1'::atomic_u128` | ERROR | 23514 |
| `SELECT '1e3'::atomic_u128` | ERROR | 23514 |
| `SELECT ' 1'::atomic_u128` | ERROR | 23514 |
| `SELECT '340…456'::atomic_u128` (max+1) | ERROR | 23514 (check "atomic_u128_within_range") |
| `SELECT '999…999'::atomic_u128` (39 nines) | ERROR | 23514 (check "atomic_u128_within_range") |
| `SELECT '0'::signed_atomic_delta` | OK | — |
| `SELECT '-1325'::signed_atomic_delta` | OK | — |
| `SELECT '-0'::signed_atomic_delta` | ERROR | 23514 (check "signed_delta_is_canonical") |

No value is silently rounded/stored: a failed fractional `INSERT` inside a rolled-back transaction leaves 0 rows; the u128 maximum round-trips exactly. `SELECT 1.5::text` returns `'1.5'` and `1.0::text` returns `'1.0'` — PostgreSQL parses numeric literals as NUMERIC and numeric→text preserves the fractional representation, so the TEXT domain regex sees and rejects them (this is precisely why `NUMERIC(p,0)` — which would round `1.5` to `2` before a CHECK — is not used). API rejects all JSON-number inputs in `packages/domain` before any SQL.

## Commands and exit codes (all actually run here)

| Command | Exit | Result |
|---|---|---|
| `node --version` / `pnpm --version` | 0 | 24.18.0 / 10.21.0 |
| `pnpm install --no-frozen-lockfile` | 0 | 69 packages, lockfile generated |
| `pnpm install --frozen-lockfile` | 0 | "Lockfile is up to date" |
| `pnpm build` | 0 | domain/api-contract/api/worker compile + emit |
| `pnpm typecheck` | 0 | strict tsc (packages + scripts) clean |
| `pnpm test` (= `pnpm build && pnpm test:run`) | 0 | 52/52 pass |
| `pnpm check` (= build + typecheck + test) | 0 | 52/52 pass |
| `pnpm db:migrate` (external, `DATABASE_URL` absent) | 1 | fail-fast "DATABASE_URL is required… db:migrate:local", before any mutation |
| `pnpm db:migrate:local` (explicit ephemeral) | 0 | applied, reported PostgreSQL 18.6 |
| `pnpm db:evidence` | 0 | honest actual/expected/passed outcomes; 18 rows all pass, rejections SQLSTATE 23514 |
| worker `KEYFOLIO_MODE=FIXTURE` | 0 | "FIXTURE idle entrypoint: no provider/source configured; exiting cleanly" |
| worker `KEYFOLIO_MODE=TESTNET` (no secrets) | 1 | "missing required configuration for TESTNET mode: NEAR_NETWORK, NEAR_RPC_URL, DATABASE_URL, PROVIDER_BASE_URL…" |
| api `KEYFOLIO_MODE=LIVE` (no secrets) | 1 | "missing required configuration for LIVE mode: …ACCESS_CONTRACT_ID, SUBSCRIPTION_FT_CONTRACT_ID…" |

## Review round 1 — independent findings and fixes

Initial run was 41/41 green, but Codex's independent probes found real defects, all fixed and re-covered before this report:

| Finding | Fix | Regression test |
|---|---|---|
| `evaluateCopyEligibility({confirmed:true, sourceExecutionAtMs:NaN, nowMs:0})` returned eligible | `validateEpochMs` rejects NaN/±Infinity/negative/fractional/unsafe ms; new `invalid_timestamp` verdict | `copy eligibility rejects NaN/Infinity/negative/fractional/unsafe/future` |
| `isReadableIdleHealthy({lastUsableAt:100, now:0})` returned true | future/out-of-order timestamps fail closed | `freshness (120s) is separate…` |
| 120s freshness was conflated with 24h outage | separate `SOURCE_FRESHNESS_MS` (120s) from `OUTAGE_THRESHOLD_MS` (24h); a 23h-old read is stale, not healthy | `freshness (120s)…` + `readable idle…beyond 24h` |
| `applyObservation` accepted invalid/out-of-order reads | ignore invalid or out-of-order observations without regressing state | `applyObservation ignores invalid…` |
| migration FKs referenced only the bare UUID (allowed network/provider mismatch) | composite `UNIQUE` + FK on `(binding_id, network, provider)`, `(binding_id, network)`, `(event_id, network)` | `composite FKs enforce…23503` |
| DB rejection tests only checked "any error" | assert SQLSTATE `23514`; INSERT numeric `1.5` and text `'1.5'` against a preexisting `'7'` sentinel, verifying that sentinel row is preserved unchanged after each rejected insert and that the u128 maximum stores with no rounding | `fractional INSERTs…sentinel` |
| `db:migrate` silently used ephemeral when URL absent | split into external `db:migrate` (requires URL, no fallback) and explicit `db:migrate:local` | `migration-target` tests + exit 1 above |
| README lacked start/env-loading docs | explicit API/worker start commands and ".env is not auto-loaded" note | — |
| down/up reversibility was only claimed, not verified | `migration is reversible: up → down → up` | test above |

Revised result: **52/52 tests pass**, `pnpm check` exits 0; DB engine PostgreSQL 18.6 (PGlite 0.5.15).

## Evidence-script honesty fix

`scripts/db-evidence.ts` previously labelled every row's outcome from the *expected* value in both the success and catch paths — an expected-ERROR statement that unexpectedly succeeded was reported `ERROR`, and an expected-OK statement that threw was reported `OK` — so contradictory behaviour could be labelled correct. It is now honest: a successful execution is always `OK` and a thrown execution is always `ERROR`, the expectation is reported separately with a `passed` boolean, the process exits `1` on any outcome or SQLSTATE mismatch, and the PGlite engine is closed in a `finally`. The shared pure classifier and injected query seam live in `scripts/evidence-classifier.ts`; `scripts/evidence-classifier.test.ts` proves that an expected reject that unexpectedly succeeds, an expected success that throws, and an unexpected SQLSTATE each fail (no fabricated evidence). `pnpm db:evidence` now emits 18 rows (version + 17 domain checks) — all pass with `actual` = `expected` and SQLSTATE `23514` on rejections.

## Test coverage vs acceptance (partial F01–F03)

Test suite: `node --test` via tsx, 52 tests, 0 failures.

- **F01 (clean install/build/run tests)** — `PASS_LOCAL`: frozen install, build, and `pnpm check` all exit 0; 52/52 tests. The GitHub Actions skeleton (`.github/workflows/local.yml`) is authored but not executed in this workspace → CI step `NOT_RUN`.
- **F02 (env modes explicit; live cannot use fixture/signing)** — `PASS_LOCAL`: `KEYFOLIO_MODE` required with no default; TESTNET/LIVE fail fast on missing secrets/source config (verified exit 1); worker refuses to fake a source/signer in non-fixture modes (unit-tested); no signer/source/readiness faking exists. Actual TESTNET/LIVE runtime `NOT_RUN` (no network/DB).
- **F03 (amount schemas reject floats/negative/overflow/unknown network)** — `PASS_LOCAL`: covered in `packages/domain` (regex + u128 bound, no coercion), `packages/api-contract` (runtime request validator), Fastify `inject` (JSON `1.5` and string `"1.5"` both → 422; unknown network → 422), and the real PostgreSQL domain (numeric `1.5` and text `'1.5'` both fail).

## Files added/changed

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.scripts.json`, `.node-version`, `.env.example`, `.github/workflows/local.yml`, `README.md` (setup section only).
- `packages/domain/**` — pure amount/mode/network/health/config rules + tests.
- `packages/api-contract/**` — envelope + amount/health wire schemas + tests.
- `apps/api/**` — Fastify health + fixture-only `/internal/validate-amount`, entrypoint, migration SQL (up/down), tests incl. `db-domain.test.ts`.
- `apps/worker/**` — idle fixture entrypoint + refuse decision + test.
- `scripts/**` — `db-migrate.ts` (external), `db-migrate-local.ts` (explicit local), `migration-sql.ts`, `migration-target.ts`, `db-evidence.ts` (honest outcome classifier), `evidence-classifier.ts` + `evidence-classifier.test.ts`.
- `docs/evidence/KF-02/**` — this report.

Preserved byte-for-byte: baseline files (`docs/planning/keyfolio-v1/*`), `docs/status.md`, `docs/decisions.md`, `DESIGN.md`, `AGENTS.md`, `apps/web`/`contracts` (not created/touched).

## Deliberately not implemented / remaining

- No web UI, contract (`apps/web`, `contracts`) — KF-02b.
- No complete OpenAPI freeze, wallet auth/credential hashing, provider adapter, real trading/signing — later tasks.
- No external PostgreSQL server run (no local server/initdb; Docker daemon unavailable) — external `DATABASE_URL`/psql path documented but `NOT_RUN`; DB evidence is the PGlite PostgreSQL engine (PASS_LOCAL), not a deployment claim.
- No commit/push (Codex reviews then commits).

## Spec deviations

None. Amount contract follows KF-D009; health/time rules follow KF-D001/KF-D002; termination cutoff (KF-D010) is not in this slice and is marked remaining.

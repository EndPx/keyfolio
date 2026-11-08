# KF-08b milestone 1 evidence — Marketplace → Trader Profile → Checkout (PASS_LOCAL, FIXTURE)

Date: 2026-11-08. Scope: the first KF-08b production flow in apps/web, per the user-approved design direction (d149f3c) plus three corrections. NO provider adapter, NO wallet signing, NO live data — KF-01 stays BLOCKED_EXTERNAL; KF-02b dispatch scope untouched.

Commit + branch: see git log; branch main.
Environment: Next.js 16.4.5 / React 19.3.1; @keyfolio/domain reused for FAIL-CLOSED config resolution; mode = FIXTURE explicitly (apps/web/.env.local, gitignored).

## What was built (single navigable flow)

- Shell per DESIGN.md: environment banner on every page (mode + network, accurate labels), sidebar nav (desktop) collapsing to a top bar (mobile ≤900px), content gutter 32/16px.
- `/` Marketplace: three seller cards matching the mockup states — Carla (COMPLETE, +8.24% TWR, PnL +214.50 USD, KF-TEST price), DeltaOne (PARTIAL → return/PnL/drawdown "Unavailable" with the gap reason, "Sales paused · partial coverage" disabled CTA), Esteban (TRACKING/insufficient, sales paused). Compact cards; user-facing language.
- `/traders/carla` Trader Profile: identity, metric cards (**Net PnL in USD** per reviewer correction 1; TWR %; drawdown), tracking facts in user language, **TWR chart as an SVG with percent gridlines (+0/+4/+8%) and date labels (Oct 8 / Oct 23 / Nov 7)** — no private balances or positions rendered, key contents, package terms (price from the PLAN configuration: 25 KF-TEST atomic 25000000 · storage 0.10 NEAR native, separate), refund policy, privacy note, CTA to checkout.
- `/checkout/carla` Checkout: order rows from plan configuration (exact atomic price, term seconds, storage separate, network/FT), refund note, and the FIXTURE-only action flow: confirm → pending → simulated success, every state labeled "FIXTURE simulated". In TESTNET/LIVE the confirm button is DISABLED with "wallet signing not wired" — no fake ownership, no always-true verifier, and fixture data is never served in those modes.

## Reviewer corrections applied

1. Public Net PnL is USD (baseline 01 section 8); KF-TEST only for subscription price/vested/refund. Holdings stay their own assets (fixture uses testnet:near/testnet:usdc labels in market descriptions only).
2. Trader Studio "Edit profile & offer" action added to the mockup (simple form = allowed seller fields only; metrics remain computed) — its page lands in the next KF-08b increment.
3. Buttons size to their text with consistent padding; mobile CTA shortened to "Buy access".

## Verification actually run

- `pnpm check`: build (all workspaces incl. next build) + typecheck + **95/95 tests** (includes the new resolver-value checks; contracts untouched by this JS/design change and were not re-run beyond the suite).
- Runtime navigation (next start, KEYFOLIO_MODE=FIXTURE, port 3123): `/`, `/traders/carla`, `/checkout/carla`, `/traders/deltaone` all HTTP 200; content assertions found "Sales paused · partial coverage", "Tracked return (TWR) · 30 days", the exact atomic price string, and the FIXTURE banner.
- **Mode separation (fail-closed)**: a second instance with KEYFOLIO_MODE=TESTNET serves the config-required error (TESTNET needs DATABASE_URL/NEAR_RPC_URL/PROVIDER_BASE_URL) and ZERO fixture numbers — caught and fixed a real bug first: static prerendering baked the build-time mode into the HTML, so pages are now `force-dynamic` and the mode resolves per request.
- Checkout interaction (Playwright): confirm → pending → success chip visible ("FIXTURE simulated receipt · no NFT was minted on any chain").
- Screenshots (tracked evidence): desktop 1440 marketplace/profile/checkout, mobile 390 marketplace/checkout/checkout-success (kf08b1-*.png in this folder).

## Review follow-up (2026-11-08, second pass)

- **Full-page checkout gating**: the mode/config gate now runs BEFORE any fixture data is read — TESTNET/LIVE/invalid configs render only the explicit explanation (config-required or not-connected); the fixture seller/plan/order rows are unreachable outside FIXTURE.
- **Mode-matrix verification**: scripts/verify-web-modes.mjs (tracked) starts its own servers against the built app and asserts all 3 routes across FIXTURE / TESTNET (valid synthetic config) / LIVE (valid synthetic config) / invalid config — **PASSED**: fixture markers present only in FIXTURE, zero leaks elsewhere, explicit not-connected/config-required text present. Spawn uses the next binary directly (pnpm wrapper did not die on child.kill in Windows).
- **Mobile navigation**: logo + simple horizontal menu (user row hidden ≤900px), banner wraps, main capped at 100vw — no horizontal overflow; Carla's card price now includes "/ 30 days" in the web fixture (reviewer finding).
- **package.json/pnpm-lock reconciled** in this commit; resolver-value.test.mjs runs inside 
> keyfolio@0.1.0 test:run D:\Belajar\Hackacton\Hackacton yang masih jalan\Keyfolio

✔ reports the actual PostgreSQL engine version (2624.0244ms)
✔ atomic_u128 casts: canonical strings accepted with exact round-trip (5.7101ms)
✔ atomic_u128 casts reject invalid inputs with SQLSTATE 23514 (check violation) (13.8461ms)
✔ SQL numeric literal 1.5 and text 1.5 both fail the domain with 23514 (2.7206ms)
✔ DB lexical limitations: numeric literals keep their fractional form before the domain rejects them (3.1225ms)
✔ fractional INSERTs (numeric and text) reject without touching a preexisting sentinel (15.8429ms)
✔ signed_atomic_delta rejects -0 and overflow with 23514, accepts canonical magnitudes (8.2397ms)
✔ keyfolio_network domain rejects unknown networks with 23514 (4.634ms)
✔ composite FKs enforce network/provider consistency (SQLSTATE 23503) (26.0987ms)
✔ foundation schema: identity/events/movement/cursor round-trip with constraints (10.8848ms)
✔ migration is reversible: up → down → up (1591.1778ms)
✔ GET /health returns mode/build info and no fake provider readiness (475.1536ms)
✔ external migration requires DATABASE_URL (no implicit ephemeral fallback) (3.7094ms)
✔ external migration resolves a target URL without ever choosing ephemeral (2.6224ms)
✔ Fastify injection accepts canonical string amounts (488.159ms)
✔ Fastify injection rejects JSON number 1.5 AND string "1.5" (422, invalid_amount) (15.0817ms)
✔ Fastify injection rejects an unknown network id (422, unknown_network) (5.4854ms)
✔ Fastify injection accepts a known network id (4.1365ms)
✔ the amount seam is unreachable in TESTNET and LIVE (404) (8.9328ms)
✔ FIXTURE worker is an idle, clean-exit entrypoint (5.4498ms)
✔ TESTNET and LIVE workers refuse to fake a source/signer (0.4873ms)
✔ L02a: failure before COMMIT leaves no partial event, movement or cursor advance (2712.7268ms)
✔ L02b: commit then lost ack -> stale retry conflicts safely, fresh retry is an idempotent no-op (29.0453ms)
✔ L03/L01: duplicate delivery never doubles events or movements (23.5838ms)
✔ L06: conflicting cursor update rejects the stale processor without partial writes (18.2323ms)
✔ binding boundaries: wrong-network event FK + asset ids must carry the batch network (5.7041ms)
✔ money: non-canonical deltas are rejected before storage (domain rule reuse) (5.3631ms)
✔ outside-Keyfolio activity is ingested with provenance preserved (7.4763ms)
✔ only CONFIRMED events post asset movements (database.md) (10.2775ms)
✔ envelope shape: data/meta/error (2.8913ms)
✔ validateAmountRequest accepts canonical string amounts (0.7279ms)
✔ validateAmountRequest rejects float, string fraction, overflow, unknown network (0.4367ms)
✔ canonical regex accepts only unsigned canonical digits (2.1449ms)
✔ signed canonical regex rejects -0 and non-canonical forms (0.5039ms)
✔ parseAtomicAmount accepts canonical strings through the u128 maximum (1.4215ms)
✔ parseAtomicAmount rejects float, negative, overflow and non-canonical inputs (0.8374ms)
✔ parseAtomicAmount never rewrites the value (no coercion/rounding) (0.4094ms)
✔ plan price must be a positive canonical amount (0.2885ms)
✔ signed atomic delta accepts canonical magnitudes and rejects -0/overflow (6.3589ms)
✔ challenge constants match D13/D14/D15 defaults (3.5827ms)
✔ challenge message is deterministic and carries every binding field (0.6279ms)
✔ A01: validation accepts a fresh challenge and rejects wrong domain/account/network/expiry (2.2949ms)
✔ A01: a consumed nonce rejects replay and simultaneous reuse (0.3834ms)
✔ A02: binding verification requires the signature to match every challenge field (0.9276ms)
✔ A04: encoded secrets are 43-char base64url from exactly 32 bytes (1.2861ms)
✔ A05/D14: credential expiry is min(7d, license expiry) and denies expired licenses (0.4465ms)
✔ A06: credential creation enforces the per-license cap of 5 (0.3174ms)
✔ A06/D13: shared token bucket allows the burst then throttles to 60/min (7.3152ms)
✔ KEYFOLIO_MODE is required and never defaults to fixture (5.6375ms)
✔ FIXTURE mode needs no external secrets (7.0692ms)
✔ TESTNET mode fails clearly without its required source/db configuration (0.5002ms)
✔ TESTNET rejects a mainnet network and accepts a complete testnet config (0.3869ms)
✔ LIVE mode requires contract identities and mainnet (0.3834ms)
✔ unknown networks are rejected (2.3974ms)
✔ recognized-but-deferred secrets warn, without failing the slice (0.7554ms)
✔ requireAppConfig returns a typed config for a valid fixture env (0.3128ms)
✔ validateEpochMs rejects NaN, Infinity, negative, fractional and unsafe values (4.3202ms)
✔ copy eligibility rejects NaN/Infinity/negative/fractional/unsafe/future timestamps (0.5769ms)
✔ copy eligibility uses the trusted execution time, not observed time (KF-D002) (0.2853ms)
✔ freshness (120s) is separate from the 24h outage threshold (0.3238ms)
✔ readable idle account stays healthy across repeated valid empty reads beyond 24h (KF-D001) (0.4087ms)
✔ unknown/unusable observations never count as a successful read and open an outage (0.3987ms)
✔ isInOutage is inclusive at 24h and never eligible for invalid threshold/state or a healthy account (0.4087ms)
✔ applyObservation ignores invalid and out-of-order timestamps without regressing state (0.2943ms)
✔ outageDurationMs and isInOutage handle valid and invalid now safely (0.4288ms)
✔ NORMALIZATION_VERSION is stable and event keys collide on all four parts (4.3815ms)
✔ L01: replaying the same events twice yields identical balances and no new applications (2.3559ms)
✔ L03: correction reverses the original effect once and posts corrected truth once (0.762ms)
✔ L03: cross-batch correction uses caller-supplied original movements (0.3601ms)
✔ L03: correction with an unknown target quarantines instead of guessing (0.4891ms)
✔ L04: unknown movement kind quarantines the event and posts nothing (0.3328ms)
✔ a resulting negative balance fails closed as incomplete (0.3091ms)
✔ L05: aligned opening + confirmed movements equal the observed closing balance (2.7833ms)
✔ L07: internal wrapper transfers never enter external flow totals (0.8567ms)
✔ status lifecycle: forward transitions pass, regressions require reconciliation (0.8993ms)
✔ movement validation rejects non-canonical deltas and empty assets (0.3989ms)
✔ CALC_VERSION and USD scale are stable identifiers (1.8918ms)
✔ parseScaledUsd is exact and rejects sign/exponent/overflow-fraction forms (3.1885ms)
✔ formatScaledUsd round-trips canonical decimals without trailing zeros (0.7743ms)
✔ F-PNL: deposit/withdrawal example yields exactly 50 USD net PnL (0.7549ms)
✔ F-PNL: deposit-only case yields exactly zero PnL (0.3434ms)
✔ net PnL is incomplete when any component is missing (never zero) (0.3897ms)
✔ net PnL rejects negative component magnitudes (0.4557ms)
✔ sumEquity: unpriced positive balance is incomplete, zero balance needs no price (P03) (0.9433ms)
✔ sumEquity computes exact scaled USD with per-item floor at 10^-12 (0.3823ms)
✔ F-TWR: cash-flow-adjusted example yields exactly 10% TWR (not PnL/capital) (0.9202ms)
✔ TWR is incomplete when a boundary valuation is missing or nonpositive (0.4247ms)
✔ TWR ignores intermediate incomplete valuations that are not boundaries (0.261ms)
✔ F-DD: wealth index yields exactly 25% maximum drawdown (0.4385ms)
✔ max drawdown picks the deepest decline and handles flat/zero/incomplete inputs (0.7302ms)
✔ ratioToPercentString rounds half-even and keeps signs exact (0.4315ms)
✔ classifyEvidenceResult sets actual and passed independently of expected (1.7345ms)
✔ an expected-ERROR check that unexpectedly succeeds fails (no fabricated evidence) (0.5892ms)
✔ an expected-OK check that throws fails (no fabricated evidence) (0.4333ms)
✔ an expected-ERROR check throwing an unexpected SQLSTATE fails (0.5575ms)
ℹ tests 95
ℹ suites 0
ℹ pass 95
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5129.5444 (glob scripts/testnet/*.test.mjs). Actual suite count: **95/95** in one combined run.
- **Temporary known limitation**: the `--test-force-exit` flag remains on test:run because PGlite teardown inside the combined node:test process crashes V8 during isolate disposal; normal cleanup is NOT proven yet.

## Known limitations (follow-up, not this milestone)

- TESTNET/LIVE pages render the not-connected state: contract price queries, wallet signing (NEP-413/wallet standard per G04), and real entitlement checks are the next KF-08b increments.
- Remaining screens (My Keys, Private Account, API Access, Trader Studio, Activity pages) and the full unavailable/stale/partial state matrix per screen.
- favicon 404 (cosmetic), IBM Plex fonts not yet licensed/installed (system fallback per DESIGN.md).
- No claim of live PnL or account-following; everything shown is FIXTURE-labeled.

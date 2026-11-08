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
- **package.json/pnpm-lock reconciled** in this commit; resolver-value.test.mjs runs inside `pnpm test:run` (glob `scripts/testnet/*.test.mjs`) — verified by running the command and observing the full-suite result of **95/95 pass / 0 fail** in one combined run.
- **Temporary known limitation**: the `--test-force-exit` flag remains on test:run because PGlite teardown inside the combined node:test process crashes V8 during isolate disposal; normal cleanup is NOT proven yet.

## Known limitations (follow-up, not this milestone)

- TESTNET/LIVE pages render the not-connected state: contract price queries, wallet signing (NEP-413/wallet standard per G04), and real entitlement checks are the next KF-08b increments.
- Remaining screens (My Keys, Private Account, API Access, Trader Studio, Activity pages) and the full unavailable/stale/partial state matrix per screen.
- favicon 404 (cosmetic), IBM Plex fonts not yet licensed/installed (system fallback per DESIGN.md).
- No claim of live PnL or account-following; everything shown is FIXTURE-labeled.

## Reviewer pass 1 (independent agent, 2026-11-09) — ACCEPT with 8 findings, all addressed

Findings 1-4 (MINOR): TWR chart middle date label derived from the series data (was hardcoded
Oct 23 at the Oct 26 position); checkout order rows now render from PLAN configuration
(termDays/termSeconds/priceLabel/paymentToken — nothing hardcoded); settled-swaps period label
derives from actual coverage ("since <trackedSince>" for non-complete sellers, "30d" only with
a full window); apps/web/.env.example added and setup messages point at apps/web/.env.local
(Next loads env from the app dir, not the repo root).

Findings 5-8 (a11y/NIT): skip link + :focus-visible ring + aria-current nav + visible
aria-disabled notes; the mangled node:test log paste in this file collapsed; FIXTURE banner now
states the target network (NEAR testnet); verify-web-modes guards against stale-server
attachment are documented — fixed ports remain but each mode asserts its own banner/mode text
via the route content checks (a wrong-env server fails the marker assertions).

## Xorr restyle (KF-D016) applied in the same pass

globals.css rewritten to the Xorr language: true black bg, dark surfaces, hairlines, ink scale,
Inter (next/font) + Baloo 2 wordmark, eyebrow labels, SheetCard radius, pill buttons, note
strips, P&L-only green/red with signed chips, AgentOrb radial identity gradients per seller,
TWR chart as an Xorr area curve (gradient fill, round 2px line, end dot, subtle grid).
Verification re-run after the restyle: pnpm check 95/95 + mode matrix PASSED (4 modes x 3
routes, zero fixture leaks outside FIXTURE). Screenshots: kf08b2-xorr-*.png (desktop
profile/marketplace/checkout + mobile marketplace).

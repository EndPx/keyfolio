# KF-08b checkout testnet preflight review fixes — worker evidence (PASS_LOCAL + read-only testnet)

Date: 2026-11-09 (Asia/Jakarta). Executor: DeepSeek Harness / GATER / DeepSeek Flash via Orca (task KF-08b checkout preflight). Ownership: Codex owns docs/status.md, docs/decisions.md, docs/AGENTS.md — none edited here. This is a worker report, not Codex acceptance, and not a claim of KF-08/G04/KF-07 completion or of any actual purchase/entitlement/auth proof.

## Scope and authority

Read-only/correctness milestone only: contract-view field mapping, explicit FT query target, TESTNET-only component mounting, first-buyer preflight gates, exact Wallet Selector action shape, and a purchase lifecycle state machine. Authority limits observed: no wallet signing, no transactions, no storage deposits, no faucet/deploy, no mainnet, no provider messages, no private keys or .env values touched. Synthetic RPC/wallet outcomes in tests are labeled; the only live evidence is public read-only JSON-RPC queries and server-HTML gating.

## Findings fixed (mapped to the task)

1. **sales_enabled vs salesEnabled** — `get_trader` JSON is snake_case (`sales_enabled`, `terminated`, `terminated_at_ms`, `current_plan_version`). `apps/web/src/testnet.ts` `TraderJson` now declares the exact fields; `CheckoutTestnet` and `StudioClient` read `sales_enabled`/`terminated`. Confirmed live: `keyfolio-access.testnet.get_trader("keyfolio-ops.testnet")` → `{"sales_enabled":true,"terminated":false,"terminated_at_ms":null,"current_plan_version":1}`.
2. **viewFtMetadata target** — `callView(method, args, target?)` now accepts an explicit contract; `viewFtMetadata` reads `ft_metadata` on `info.ft_id`, never on ACCESS. Metadata failure throws (no quiet null); the checkout has no 6-decimal fallback and uses the real `symbol` from metadata. Confirmed live: `ft_metadata` on `keyfolio-usdc.testnet` → `UNKNOWN_ACCOUNT` (FT not deployed) — the preflight blocks accordingly.
3. **TESTNET-only mount** — `apps/web/src/checkoutMount.ts` + the checkout server page mount `CheckoutTestnet` only on exact `TESTNET`; `LIVE`/invalid config fail closed. The single demo trader is labeled by its real account id (default `keyfolio-ops.testnet`), not the `carla` route slug. Verified by `scripts/verify-web-modes.mjs`.
4. **First-buyer preflight** — `apps/web/src/preflight.ts` aggregates: FT code deployed + metadata (decimals/symbol), plan active/version, trader `sales_enabled && !terminated`, ACCESS registered as FT receiver, buyer FT registration/balance, buyer prepaid ACCESS native storage vs `storage_minimum_balance`. Every read is bigint-exact; storage (native NEAR) is separate from the FT price; `fetchedAtMs` + final block context are recorded and a result older than 30s disables actions (`isPreflightStale`/`canPurchase`).
5. **Action builders** — `apps/web/src/nearActions.ts` returns the actual `transactions.functionCall` `Action` instances from `near-api-js` 6.4.0 (single deduped `@near-js/transactions` 2.5.1 in the lockfile, so no `as never` cast); used for purchase (ft_transfer_call) and withdraw (ft_withdraw). Exact args/gas/deposit asserted in tests.
6. **Purchase lifecycle** — `apps/web/src/purchaseFlow.ts`: `awaiting-wallet` → `submitted`/`pending-unknown`/`failed` → `confirmed` only after `has_purchase` + derived license owner == buyer. `purchase_id` + bound payload (network/access/FT/trader/plan/price/buyer) persisted in browser storage for retry/reload; `blocksResubmit` prevents a blind re-mint until the result is recovered; a public owner read is never treated as private entitlement. A 10s on-chain smoke plan is never presented as a 30-day right.
7. **Root test wiring** — `package.json` `test:run` now includes `apps/web/test/**/*.test.ts` and `scripts/testnet/*.test.mjs`. The prior report claimed the resolver glob was wired but it was not; it is now actually executed.

## Dirty config diff (preserved, evaluated)

`packages/domain/src/config.ts` carried one pre-existing line (`missingRequired` wrapped in `[...new Set(...)]`). It deduplicates a real double-push of `NEAR_NETWORK` in the non-FIXTURE branch (harmless correctness fix). Inspected and left untouched; no comment rewrite.

## Files changed / diff

- Modified: `apps/web/src/testnet.ts`, `apps/web/src/app/checkout/[id]/page.tsx`, `apps/web/src/app/checkout/[id]/CheckoutTestnet.tsx`, `apps/web/src/app/studio/StudioClient.tsx`, `package.json`, `scripts/verify-web-modes.mjs`.
- Added: `apps/web/src/checkoutMount.ts`, `apps/web/src/nearActions.ts`, `apps/web/src/preflight.ts`, `apps/web/src/purchaseFlow.ts`, `apps/web/test/{testnet,preflight,nearActions,purchaseFlow,checkoutMount}.test.ts`.
- `packages/domain/src/config.ts` unchanged from its pre-existing dirty state.
- Not touched: contracts, migrations, `packages/api-contract`, `packages/provider-adapter`, baseline files, docs status/decisions/AGENTS, `.env*`.

## Commands and exits

- `pnpm -r --if-present run typecheck` — exit 0 (domain, api-contract, api, worker, web).
- `tsc -p tsconfig.scripts.json` — exit 0.
- `pnpm --filter @keyfolio/web build` — exit 0.
- `node --import tsx --test --test-force-exit <all test:run globs>` — **132/132 pass**, exit 0 (32 apps/web tests + 5 scripts/testnet resolver tests now included; `--test-force-exit` retained as the known PGlite teardown limitation).
- `node scripts/verify-web-modes.mjs` — PASS, exit 0 (4 modes × 8 routes; fixture data confined to FIXTURE; TESTNET mounts the checkout/wallet clients; LIVE/invalid mount none).
- Public read-only RPC probe (rpc.testnet.near.org) — exit 0 (values below).

## Actual library versions

near-api-js 6.4.0 (re-exports `@near-js/transactions` 2.5.1, single instance in pnpm-lock); @near-wallet-selector/core, /modal-ui, /my-near-wallet all 10.1.4; next 16.4.5; react 19.3.1.

## Read freshness / observed gates (actual read-only testnet)

- Finalized block at read: height 276917828 / hash `E9CJM6ZDZ2ND2sgg…`, timestamp 2026-11-09 ~19:03 WIB.
- `keyfolio-access.testnet.contract_info` → `{"version":"kf-05c-wip","owner_id":"keyfolio-ops.testnet","monitor_id":"keyfolio-monitor.testnet","ft_id":"keyfolio-usdc.testnet"}` — the contract IS deployed (contrary to the 2026-11-09 status.md note that records UNKNOWN_ACCOUNT/invalid deployment; status is stale relative to live RPC, noted but not edited here).
- `get_trader("keyfolio-ops.testnet")` → sales_enabled true, current_plan_version 1 (snake_case confirmed).
- `get_current_plan("keyfolio-ops.testnet")` → `{"price":"101","term_ms":10000,"active":true}` — a 10-second smoke plan.
- `storage_minimum_balance` → `"32720000000000000000000"` yoctoNEAR (~0.03272 NEAR) — u128-as-string confirmed.
- `keyfolio-usdc.testnet.ft_metadata` / `ft_balance_of` / `storage_balance_of(access)` → `UNKNOWN_ACCOUNT` (FT not deployed, G02 still faucet-blocked).
- `keyfolio-access.testnet.storage_balance_of("keyfolio-ops.testnet")` → `"0"`.

Net observed gate state: FT not deployed + metadata unavailable + no buyer prepaid storage ⇒ purchase correctly disabled in the UI. An "active 10s plan" is not a 30-day right.

## Synthetic vs actual evidence

- Synthetic (unit tests, fake RPC + fake wallet outcomes): field mapping/query-target, blocking metadata/RPC/stale/missing-storage/missing-block, exact action shape, and lifecycle success/rejected/ambiguous/timeout/stable-id, restore seam, pending+changed-plan block, confirmed no-resubmit. 132 tests.
- Actual read-only: the live RPC probe above (contract views + block height) and the server-HTML mode matrix (`verify-web-modes.mjs`). Browser hydration (client-side post-load queries, wallet modal, signing) was NOT run — no browser automation is available in this worker context, so hydrated TESTNET behavior is recorded NOT_RUN rather than claimed from the HTML grep (the mode script now documents this distinction).

## Unresolved demo blockers

1. Subscription FT `keyfolio-usdc.testnet` is still UNKNOWN_ACCOUNT (G02 faucet/deploy pending) — no metadata/registration/balance, so purchase stays disabled and is not claimable as a purchase proof.
2. No browser tool here for a hydrated TESTNET smoke (wallet connect / sign) — recorded, independent tests unaffected.
3. The live plan is a 10-second smoke plan; the license flow must not (and does not) present it as a 30-day right.

## Revision (Codex pass 1) — four recovery blockers fixed, 132/132 pass

1. **Async-account restore seam** — `CheckoutTestnet` no longer reads storage at mount with a null account. A React effect restores via `restorePurchase(storage, binding)` whenever `accountId`/`accessContract`/`traderId` change, validating the saved payload against the binding; `restoreComplete` (account resolved and record restored) gates the buy button until the restore finishes, so a pending/failed record cannot be bypassed for one render.
2. **Error classification** — `applyWalletError(err)` now only treats an EXPLICIT user rejection (message/type containing reject/denied/cancel/refused/declined) as definitive `failed`. Transport/timeout/provider errors stay `pending-unknown` with the SAME id and the recover action, and no blind resubmit.
3. **New-intent blocking** — `resolveOrCreatePayload` returns a discriminated `{kind:'new'}` / `{kind:'blocked', record, reason}`. A persisted UNRESOLVED attempt blocks a new id even if plan/price changed; a persisted `confirmed` attempt blocks re-purchase; only idle or definitively-`failed` offers a `new` intent. `canOfferPurchase(state)` is the render gate (idle/failed only).
4. **Block context gate** — preflight now emits a `block-context` gate (false when the final block/finality read fails) and `canPurchase` requires every gate, so an unreadable finality/block context disables the action instead of being a warning-only.

Tests added/updated for these: `restorePurchase` seam, persisted-pending-with-changed-plan block, timeout vs explicit-reject, confirmed/no-resubmit (`canOfferPurchase`), and missing-block-disabled gate. Full suite `node --import tsx --test` = **132/132 pass**; `apps/web` typecheck exit 0; web build exit 0; `verify-web-modes.mjs` PASS. Browser hydration remains NOT_RUN (no browser tool) and is left truthful.

## Revision (Codex pass 2) — tightened rejection detection, 133/133 pass

`isExplicitRejection` now rejects only USER-anchored signals: a tight `type` set (`userrejected`, `userrejectederror`, `rejectedbyuser`, `rejectedbyusererror`, `userdenied`, `usercancelled`, `userrefused`) or the exact wording `user rejected|cancelled|denied|declined|refused`. Generic transport/provider conditions — "RPC connection refused", "Provider access denied", "connect ECONNREFUSED", "request refused by server" — now classify as ambiguous (`pending-unknown`, `rejectedByWallet:false`) instead of a definitive user cancellation. Two focused regressions added and the explicit-rejection pass retained. Focused `apps/web/test/purchaseFlow.test.ts` = 17/17; full `node --import tsx --test` = **133/133 pass**; `apps/web` typecheck exit 0.
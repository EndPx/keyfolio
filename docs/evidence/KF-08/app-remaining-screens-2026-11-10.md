# KF-08 remaining app screens — 2026-11-10

Status: **PASS_LOCAL** for the visual slice. This evidence covers the app-facing routes `/keys`, `/private`, `/api-access`, `/activity`, and `/studio` in `apps/web`. Landing and backend/contract/provider surfaces were not changed.

The routes now share the accepted light analytical workspace grammar: dark rounded rail, near-white canvas, white rounded panels, black pill actions, restrained green/blue state accents, and a single-column mobile companion layout. The visual slice is read-only: no purchase, withdrawal, credential issuance, or other wallet transaction is mounted by these routes.

## Mode boundaries

- **FIXTURE:** clearly labeled `FIXTURE · illustrative sample` surfaces may show demo balances, credentials, activity, keys, and computed metrics. These values are explicitly illustrative.
- **TESTNET:** the same routes render wallet-required states through the existing wallet context. They do not render fixture values, fake ownership, private account data, or transaction results. The connect action only opens the existing wallet selector when the user chooses it; no signing action was invoked during capture.
- **LIVE/configuration failure:** the routes fail closed with an unavailable/configuration panel and do not fall back to fixture data.

## Browser captures

Production `next start` was exercised with Playwright Chromium at 1440×900 and 390×900 for every route. The raw observations are in [`observations.json`](./app-remaining-screens-2026-11-10/observations.json) and [`testnet-observations.json`](./app-remaining-screens-2026-11-10/testnet-observations.json); PNG captures are stored beside them.

| Mode | Widths | Routes | Overflow | Fixture leakage |
|---|---:|---|---|---|
| FIXTURE | 1440, 390 | all five | false for all 10 captures | expected labeled sample only |
| TESTNET | 1440, 390 | all five | false for all 10 captures | false for all 10 captures |

TESTNET captures also contained the wallet connect/read-only prompt on every route. No transaction builder or `signAndSendTransaction` call is referenced by the new page surfaces.

## Validation

- `pnpm check` — **157/157 tests PASS**; build and typecheck pass.
- Focused route/mode tests — **4/4 assertions pass** across route rendering, non-fixture mode gates, and read-only transaction guards.
- `pnpm --filter @keyfolio/web typecheck` — pass.

This is local browser evidence only. It does not establish finalized TESTNET ownership, provider ingestion, private entitlement, API credential issuance, wallet signing, withdrawal settlement, or LIVE readiness.

Codex review: PASS_LOCAL for the visual slice. The five routes share the accepted light analytical grammar, TESTNET remains read-only and wallet-required, and no transaction builder is mounted by these screens. Commit/push follows this review; live ownership and provider gates remain external.

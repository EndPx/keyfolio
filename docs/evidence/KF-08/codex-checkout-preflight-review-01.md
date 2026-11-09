# Checkout preflight independent review01

Date:2026-11-09. Codex. Result:CHANGES_REQUIRED, no implementation acceptance or source commit.

Worker report received for task39691c123e7a. Independent focused command `node --import tsx --test --test-force-exit apps/web/test/**/*.test.ts scripts/testnet/*.test.mjs` passed31/31. Source confirms snake_case mapping, explicit FT view target, no decimals fallback, TESTNET-only checkout mounting and action builder cast removal. These test results do not prove browser signing or live purchase.

Remaining review findings: Checkout useState reads pending record only at initial mount, before accountId is restored asynchronously, and no account-change restoration effect exists. Generic wallet exceptions treated as definitive cancellation enable retry after an ambiguous network error. Changed price/plan can allocate a new ID while an earlier persisted attempt remains unresolved. Confirmed state permits another buy using the same ID. Missing finalized-block context is warning-only rather than an action-blocking gate. Revision requested on the same worker through its mailbox; scope kept to practical recovery/preflight regressions, no transactions.

Browser hydrated TESTNET smoke remains NOT_RUN at this checkpoint. Worker126-suite/build/mode verification claims remain reported evidence until final reviewed revision and necessary independent checks. No secrets or private account payloads used in review. Full KF08/G04/KF07 not accepted.

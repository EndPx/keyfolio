# KF-04 local performance/public projection evidence

Classification: **PASS_LOCAL** for the bounded fixture slice only.

## Scope

- Worker-owned projection path uses the exact `packages/domain` PnL, cash-flow-adjusted TWR and maximum-drawdown rules.
- A qualified injected fixture price source is required for valuation. No provider, RPC, wallet, signing, deployment or paid service was used.
- `performance_snapshots` is an additive, reversible migration (`0004_kf04_performance_snapshots.sql`). It stores only aggregate public fields, coverage boundaries, state/stale labels, calculation version, price provenance and a replay watermark.
- The public serializer is an allowlist seam. It excludes balances, positions, activity identifiers, raw provider payloads and secrets.

## Focused observations

| Case | Expected | Observed |
|---|---|---|
| P01 | Deposit/withdrawal fixture produces exactly 50 USD net PnL | PASS |
| P02 | 1000 -> 1100, deposit 900, -> 2000 produces exactly 1000 bps TWR | PASS |
| P03 | Missing historical price is unavailable/null, never zero | PASS |
| P04 | Already-net valuation is not charged a duplicate fee | PASS |
| P05 | Stale source is labelled stale; no invented zero valuation | PASS |
| P06 | Public read model contains only the allowlisted aggregate fields | PASS |
| Replay | Same ledger/price inputs produce byte-equivalent output and one persisted row | PASS |

Validation command: `pnpm check`

Observed result: **152/152 tests passed**, including build and typecheck.

## External boundary

Historical/live price capability remains **NOT_RUN / BLOCKED_EXTERNAL (G03)**. The fixture source proves only deterministic local wiring and exact arithmetic; it does not qualify a real historical provider, asset coverage, timestamp granularity, reuse rights, quota, cost or reliability.

This evidence does not claim full KF-04 acceptance, live performance, or a complete HTTP API handler.

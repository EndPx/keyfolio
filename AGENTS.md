# Keyfolio agent entrypoint

Read in order: `docs/status.md`, `docs/decisions.md`, `docs/architecture.md`, then the task-relevant baseline in `docs/planning/keyfolio-v1/`. Read `docs/database.md` before schema changes and `DESIGN.md` before visual changes. This order restores the active assignment before new work is dispatched.

Material integration choices follow KF-D012 NEAR ecosystem first; consult/update `docs/capabilities.md` with official sources, actual experiment or NOT_RUN, permissions, cost/reliability and explicit gaps before selecting an external alternative. Add integrations only for a real requirement; this preference never relaxes scope, user rights or acceptance.

Authority: explicit user decisions > decisions.md amendments > baseline file 01 for product behavior > baseline file 02 for acceptance. Status records evidence; it cannot redefine requirements. Preserve the four baseline files byte-for-byte.

Codex coordinates, freezes interfaces, reviews diffs and accepts evidence. Implementation executor: actual DeepSeek Harness, GATER provider route, DeepSeek Flash model through Orca. Prove task receipt/result/review first; never relabel another executor. Use installed version-matched Orca guides and follow dispatch lifecycle. One implementation writer per checkout; Codex owns docs/status and integration. Do not restart a worker based on silence.

Preserve account-following, including supported external-interface activity. App-only coverage, scope cuts, custody changes and customer-right changes require user decisions. A readable idle account is healthy. Assisted-copy age uses trustworthy source execution/confirmation time; discovery/backfill time cannot make an old trade eligible.

Use atomic strings and bigint/exact arithmetic for money, UTC for persisted times. Test auth and financial invariants against independent expected values. Source observations and chain projections are not interchangeable authorities. Unknown capabilities stay UNKNOWN/BLOCKED_EXTERNAL.

Local implementation and testing are authorized. GitHub repository creation/publication was explicitly authorized on 2026-11-06; publish reviewed source and sanitized evidence only. Funds, paid services, wallet-key changes, deployments and public paid launch require their missing explicit authorization. Public paid launch also requires acceptance of vesting/refund/monitor policy. Never commit secrets, raw account data, sessions or private operational logs.

At a checkpoint update status with task states, dispatch IDs, ownership, evidence, blockers and next action. Use PASS_LOCAL, PASS_TESTNET, PASS_LIVE, BLOCKED_EXTERNAL, FAILED or NOT_RUN; mixed-network release evidence is PARTIAL_INTEGRATION. Worker IMPLEMENTED is not Codex ACCEPTED.

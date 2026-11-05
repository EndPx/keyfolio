# Keyfolio decisions

Latest explicit user instructions override the immutable handoff. Implementation choices below are accepted working defaults; public-commercial approvals are separate.

## KF-D001 — Account health measures access and valid observations

Date: 2026-11-06. Owner: user. Status: binding.

No new trade is not an outage. Health measures successful authorized account reads, observation freshness and account-data validity. An idle but readable account must never enter service termination because its latest trade is old. Track last successful observation independently of last economic activity. A valid empty history page is not a failure; auth errors or incomplete/invalid responses cannot be converted to successful empty history.

The 24-hour monitor default applies to continuous inability to obtain usable authorized data, not trade inactivity. Monitor evaluation uses a monotonic outage interval and persisted evidence; process restart cannot erase it. Coverage/PnL completeness is a separate state from connectivity health. Tests: idle account remains healthy beyond 24h; unsuccessful reads never reset outage; valid observations reset the outage; consent withdrawal terminates immediately under the baseline policy.

## KF-D002 — Copy age comes from trusted source economic time

Date: 2026-11-06. Owner: user. Status: binding; supersedes D16 discovery-time interpretation.

Assisted copy requires a confirmed spot swap with a trustworthy source execution/confirmation timestamp. Eligibility age is server-now minus that source timestamp, at most five minutes. `observed_at` records discovery only and must not rejuvenate a backfilled trade. Missing/untrusted, future or semantically ambiguous source timestamps disable copy with an explicit reason. `createdAt` alone is not proof of execution/confirmation time. A later status update or repeated observation cannot reset age. Check eligibility again before new quote/submission, together with quote expiry and license validity.

Tests: old trade discovered now denied; recent trusted confirmed trade eligible; missing/untrusted/future time denied; non-confirmed trade denied; timestamp exactly five minutes old eligible, older denied. Conservative fail-closed handling does not modify account-history coverage.

## KF-D003 — Immutable baseline and persistent context

Date: 2026-11-06. Owner: user/Codex. Status: accepted.

Copy the four supplied handoff files without edits into `docs/planning/keyfolio-v1/`; record SHA-256 provenance. File 01 owns product behavior; file 02 owns test IDs. Amend behavior here rather than quietly rewriting the baseline. `docs/status.md` owns current progress, dispatches and evidence; architecture.md owns module/authority boundaries; database.md owns persistence; DESIGN.md owns visual rules. AGENTS.md is the recovery entrypoint, not a duplicate specification.

## KF-D004 — Vesting, refund and monitor default is local-only approval

Date: 2026-11-06. Owner: user. Status: binding.

Implement and test the handoff's linear vesting, funded service-termination refunds and restricted service monitor locally. Applying this policy to paying public customers requires a user decision. No upfront irrevocable payout substitution. No mainnet spending/deployment authorization is implied.

## KF-D005 — Public repository

Date: 2026-11-06. Owner: user. Status: authorized.

Create public GitHub repository `EndPx/keyfolio` using the authenticated EndPx account. Publish reviewed project source/docs and sanitized evidence. Keep machine paths, runtime handles, credentials and raw account responses in ignored `.deploy-local/`. Repository publication does not authorize deployment, customer onboarding or hackathon submission. No software license is selected yet; do not invent licensing rights.

## KF-D006 — Modular monolith with distinct authority

Date: 2026-11-06. Owner: Codex. Status: accepted implementation default.

Use baseline Next.js/Fastify/Node worker/PostgreSQL/Rust near-sdk. One API and one worker initially; pure domain and API contracts are shared, provider adapter is server-only. No Redis, message broker or microservice split until measured need. PostgreSQL transactions/unique constraints own off-chain idempotency; the NEAR contract owns subscription liabilities and NFT state. Rationale and detailed interfaces: architecture.md and database.md. Version pins wait for KF-02 compatibility checks.

## KF-D007 — Visual system v1

Date: 2026-11-06. Owner: Codex. Status: selected implementation contract; rendered QA pending.

Light analytical workspace, navy text, cobalt actions, restrained financial colors. Public discovery is comparison-led; private workspace is activity-led. A key/portfolio logo signals licensed visibility. Canonical tokens/components/accessibility are in root DESIGN.md. Do not create per-screen themes or imply verified returns through decorative charts.

## KF-D008 — Executor route

Date: 2026-11-06. Owner: user. Status: required; runtime proof pending.

Use DeepSeek Harness with GATER API and model DeepSeek Flash, through Orca. Configuration inspection must prove endpoint route/model without exposing credentials. Neither a model's self-description nor a successful CLI version check proves the task/result/review loop. If the CLI profile differs from the connected desktop profile, report/resolve the exact mismatch; do not substitute official DeepSeek, ZCode or another model.

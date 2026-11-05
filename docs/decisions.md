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

## KF-D009 — Reject fractional atomic amounts before database coercion

Date: 2026-11-06. Owner: user/Codex. Status: binding.

Atomic amounts cross API boundaries only as canonical decimal integer strings matching `^(0|[1-9][0-9]*)$`, with a checked u128 upper bound. JSON number1.5 and string `1.5` must both fail. No rounding, truncation, exponent, signs, whitespace or implicit coercion is allowed. Use a PostgreSQL TEXT domain with the same digit/length/range checks rather than NUMERIC(p,0), whose input coercion can round before a CHECK sees the value. Enforce positivity separately for prices and preserve zero for valid balances. Signed ledger deltas use a separately validated signed canonical integer representation, never an unsigned domain with a hidden negative conversion.

Database acceptance must insert fractional inputs directly as well as through the API, and demonstrate failure without changing an existing value. Cover0,1,u128 maximum, overflow,1.5,'1.5', leading zeros, negatives and exponents. Application parameterization passes strings; numeric literals cannot be rounded into validity. This is a persistence amendment to database.md, not a change to money semantics.

## KF-D010 — Termination cutoff is contract execution time

Date: 2026-11-06. Owner: user. Status: binding local baseline.

For local/sandbox contract implementation, cutoff_ms is the checked block timestamp of the transaction in which the contract accepts termination. A caller cannot supply an earlier outage timestamp as the financial cutoff. The monitor's24h outage evidence controls eligibility to request termination, not retrospective vesting. Consent withdrawal requests termination immediately, but financial cutoff is still when the contract accepts that transaction.

Freeze tranche earnings at cutoff_ms, subject to each tranche's term. Already vested funds before cutoff remain trader entitlement; refund is the unvested remainder at cutoff, payable to the current NFT owner under transfer/refund locking rules. Example:30-day term priced300 units; outage starts at day10, accepted termination at day11 -> earned110/refund190 (ignoring atomic rounding), not earned100/refund200. Delay until term end can leave zero refundable remainder. Previously withdrawn vested amounts must never be promised again as refunds.

Disclose that this default does not automatically compensate the interval from outage start to accepted termination and depends on monitor responsiveness. Retroactive refunds require a separately funded and approved policy; do not backdate cutoff or create unfunded obligations. Public paid launch remains subject to KF-D004 user approval. Test supplied backdating rejection, repeated termination idempotency, cutoff at start/mid/end, delayed monitor, pending payouts and solvency.

## KF-D011 — Standing delivery mandate and automatic continuation

Date:2026-11-06. Owner:user. Status:binding.

Continue KF-00 through KF-11 under the existing scope/acceptance and authorization limits. KF-00/C00 is already ACCEPTED; never restart it without contradictory evidence. Resume the existing KF-02a dispatch, review every result, return acceptance gaps to the executor, and automatically select the next dependency-ready task after acceptance. Worker completion alone is not acceptance. Milestones: implementation -> Codex review -> relevant tests -> revisions -> reviewed commit -> push. No additional routine continuation approval is required.

Executor remains proven DeepSeek Harness/GATER/DeepSeek Flash through Orca. Do not change/test working runtime configuration without a concrete reason. Follow Orca wake-up lifecycle; ending a coordinator turn is not a request for the user to type continue. One lockfile/migration/contract writer; independent work may proceed only with explicit disjoint ownership.

Blocked upstream access does not stop independent local work and cannot be replaced with repeated unauthenticated probes, app-only scope, fabricated data or fixture fallback in LIVE. Ask only for missing access/credentials (never secret values in chat), scope/financial-right decisions, paid services, real-asset actions/deployments or unresolved product decisions. If all remaining tasks are truly externally blocked, deliver one consolidated list of completed scope, unproven scope and minimum user actions; do not mark the project complete. Internal target remains2026-11-14 23:59 WIB, with schedule risks disclosed when observed.

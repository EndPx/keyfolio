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

Date: 2026-11-06. Owner: user. Status: binding; C00 runtime proof accepted (see status/evidence for current provider availability).

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

## KF-D012 — NEAR ecosystem first

Date:2026-11-06. Owner:user. Status:binding.

For each material relevant need, evaluate NEAR ecosystem products/infrastructure before external alternatives. Choose based on evidenced feature coverage, network/wallet support, authentication/signing/recovery, API permissions, security/fund authority, costs, reliability and integration effort. Ecosystem affiliation alone is not evidence of capability. Do not add an integration without a concrete product function.

Preserve Confidential Intents account-following, NEAR contracts and transferable access NFTs as planned. This rule does not change scope, user rights, acceptance or financial authorizations. If a NEAR option is insufficient or gated, record the exact gap and a concrete compatible alternative where one exists; scope/rights changes still require user decision. Paid services and deployments retain existing approval boundaries. No silent fixture/live substitution.

Canonical material-choice matrix: [capabilities.md](capabilities.md). Each choice records official sources, observed experiment or NOT_RUN, decision and missing evidence. Update the owning row when selecting/pinning a real integration; keep runtime status in status.md. Continue independent tasks without waiting for unrelated ecosystem evaluation. Existing off-chain PostgreSQL and executor route are retained for their assigned functions; no gratuitous chain storage, oracle, bridge or agent integration.

## KF-D013 — Session implementation mandate, FigCraft-first UI, testnet-first order

Date:2026-11-07. Owner:user. Status:binding.

While the GATER executor gate persists, the user directed this working session to implement all non-blocked tasks directly (KF-02c, KF-03..KF-08 local scope) in dependency order, alongside coordination duties. The open KF-02b dispatch remains BLOCKED_EXTERNAL and untouched; its reserved scope (packages/api-contract additions, packages/provider-adapter) is not implemented by this session until the user decides otherwise, so a returning dispatch cannot collide. KF-01 stays blocked on user action.

UI work MUST begin with FigCraft mockups of the baseline section 14 screens (using DESIGN.md tokens), reviewed by the user, before production screen implementation in apps/web.

## KF-D014 — Marketplace clarification: trader access offering, not NFT resale

Date:2026-11-07. Owner:user. Status:binding clarification.

The Keyfolio "marketplace" is where TRADERS sell access/subscription to their trading account activity: trader listing, profile, price/package, purchase and customer access. This is the existing v1 Discover/Profile/Trader Studio flow already covered by baseline file 01 and the mockups. The NFT resale marketplace between followers remains out of v1 scope per baseline section 2. No scope change is introduced by this clarification; naming/copy in UI may use "Marketplace" for the Discover surface.

## KF-D015 — Marketplace design rules: seller data vs system-computed metrics

Date:2026-11-07. Owner:user. Status:binding design contract for the marketplace surface.

Seller-editable profile fields: display name, avatar, handle/account identity, bio and a short trading-approach description, and the access package price in the allowlisted payment token (G02). Performance metrics (net PnL, return/TWR, maximum drawdown, settled swap count, coverage, snapshots) are ALWAYS computed by Keyfolio from allowed, normalized, reconciled account data with a qualified price source. There is no seller input for PnL, return, drawdown, trade counts or performance history; profit screenshots are never an authoritative marketplace source. A strategy description is seller profile information, not a separate portfolio and never a replacement for the source account (account-following is preserved, including supported activity from outside Keyfolio).

Marketplace card must show: identity (avatar/name/handle), short approach description, period return as the primary visual metric when valid, net PnL, maximum drawdown and settled swaps for the SAME labeled period, coverage (tracked-since, complete window, gaps), last public snapshot time with timezone, access price and package duration (default 30 days), and a "View profile" CTA leading to detail before checkout. Metrics carry explicit period labels; layout stays clean when metrics are unavailable; not everything collapses into small badges.

Trader detail page shows: seller identity/description, aggregate performance chart over the labeled period with coverage_start, the four metrics, data completeness/gaps/last snapshot, package contents (account activity, balances/positions, retained history, API access, assisted-copy eligibility per baseline), the earliest genuinely available history date, price/token/network/duration with storage cost listed separately, renewal/transfer/service-termination/refund terms, and a purchase CTA naming the next step. No tiered packages, performance fee, automatic copy, ratings/reviews, follower counts or achievement badges in v1.

Metric honesty: deposits are not profit; net PnL follows baseline (equity_end - equity_start - external_deposits + external_withdrawals); TWR only with valid cash-flow-boundary valuations; drawdown only from a valid TWR wealth index; unavailable metrics render as unavailable with a reason, never zero; no win rate/Sharpe/realized-unrealized split/annualization/"verified PnL" in v1; the term is "Tracked performance"; no charts before coverage_start and no projection of short history into monthly/annual figures; money stays atomic strings/exact arithmetic end to end.

Public vs keyholder: the public sees only trader-consented profile and aggregates. Activity detail, precise trade timestamps/amounts, private balances and positions sit behind NFT entitlement checks; no public preview may leak holdings, trade detail, provider credentials, source session tokens or private source identity. The NFT grants read access for its active term only; it never grants authority to spend trader funds; assisted copy uses follower funds and a fresh explicit signature.

States to design (FigCraft): complete-coverage positive performance; negative and zero performance; new seller with insufficient history; unavailable return/drawdown with reasons; stale snapshot; partial/unknown coverage; source disconnected or consent withdrawn (with sales blocked and existing-subscriber handling); idle account with successful reads (idle is not service death); loading, empty marketplace and upstream error. Last-trade time, source observation freshness and public snapshot time are displayed as separate facts. New sales/listing follow coverage and source-health requirements: no active purchase CTA where baseline blocks sales (PARTIAL/UNKNOWN coverage, incomplete source data, terminated or consent-withdrawn service).

Discovery ordering: default newest active profiles; performance sorting only compares profiles with complete coverage over the SAME window; a 3-day return is never ranked against a 30-day return; period filters must show insufficient history rather than assume 7/30-day data exists.

Sample data in FigCraft is labeled "Illustrative sample" and never presented as real trader performance; synthetic-data app runs carry accurate FIXTURE/TESTNET labels; the not-yet-selected payment token stays a placeholder. Rendering the .figcraft file is a review artifact, not user design approval.

Chain execution order is TESTNET first, mainnet later. Sandbox/local tests remain authorized; actual testnet account creation, funding and deployment still require the user's selected account/signing route and exact prepared steps. No mainnet action without its existing explicit authorization.

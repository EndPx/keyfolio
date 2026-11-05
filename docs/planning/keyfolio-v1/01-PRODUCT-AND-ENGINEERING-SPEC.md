# Keyfolio product and engineering specification

Version 1.0. Normative terms MUST/MUST NOT are acceptance requirements. DEFAULT is an implementation choice selected by this plan, not a fact previously confirmed by the user. OPEN_GATE must be resolved with evidence before dependent live behavior is enabled.

## 1. Fixed product identity

R-01 Name: Keyfolio. Working tagline: Performance in public. Strategy by invitation.
R-02 Trader B enrolls its own NEAR Confidential Intents account and consents to authorized disclosure. Follower A purchases a license NFT to view that account.
R-03 One trader profile maps to one immutable source-account binding in v1. One NFT licenses one trader profile. Many followers may each hold a license for B. A may hold licenses for several different traders.
R-04 Track all supported trading/account activity of B, including activity placed outside Keyfolio when upstream supports it. Do not claim coverage of B's unrelated chains, wallets, or protocols.
R-05 Public users see only consented aggregate performance and public profile. Active NFT holders see the subscribed account's normalized activity, balances/positions, and trade detail. They never receive B's credentials or transaction authority.
R-06 Completion target includes account ingestion, reconciled performance, payment/mint, NFT access, API credentials, transfer/renewal, dashboard, and assisted copy. P0/P1 controls execution order, not permission to omit P1 and call the original scope complete.

## 2. Explicit exclusions

No automatic copy, leverage/perpetual engine, sub-account per NFT, NFT resale marketplace, cross-chain NFT purchase, trading custody, performance fee, agent marketplace, token issuance, ZK PnL proofs, or TEE implementation in v1. No integration with ShowStake beyond README disclosure if required for submission. These are separate future decisions.

## 3. Binding defaults and open gates

| ID | Decision | Rule |
|---|---|---|
| D01 | Access duration | DEFAULT 30 days = 2,592,000 seconds; active iff now < expires_at |
| D02 | Package | DEFAULT one package per trader; read activity, positions, history, assisted-copy eligibility |
| D03 | History access | All retained authorized history since published coverage_start; show earliest available time |
| D04 | Pricing | Trader selects a positive atomic price in the single allowlisted subscription FT; no invented market price |
| D05 | Platform fee | DEFAULT zero for v1; no performance fee |
| D06 | NFT transfer | Enabled; remaining duration unchanged; credential epoch changes on every ownership transition |
| D07 | Renewal | Current owner only; new expiry = max(now, old expiry) + 30 days; current accepted price applies |
| D08 | Source replacement | Not allowed on existing profile; enroll a new profile and retain old history |
| D09 | Wallet authentication | NEAR account signature first; additional wallet standards deferred |
| D10 | Public updates | Daily 00:00 UTC snapshot, most recently complete valued day; no fake 7/30-day history |
| D11 | Confidential ingestion | Poll target 15 seconds, respect provider rate limits/backoff; default stale threshold 120 seconds |
| D12 | NFT revocation bound | Deny old credentials within 30 seconds of finalized ownership change; measured, not claimed until tested |
| D13 | API quota | DEFAULT 60 requests/minute/license, burst 10; all credentials share the limit; max 5 credentials/license |
| D14 | Credential lifetime | At most 7 days and never beyond license expiry; create replacement manually; secrets shown once |
| D15 | Browser session | 15 minutes, secure HttpOnly cookie; entitlement checked separately on private requests |
| D16 | Copy freshness | Only confirmed swaps observed <=5 minutes ago; explicit manual confirmation, fresh provider quote |
| G01 | Upstream access | OPEN_GATE: permissions, history completeness, reuse of data, auth refresh/revocation, account binding |
| G02 | Subscription asset | OPEN_GATE: actual FT contract/network/decimals and storage behavior verified; testnet mock labeled |
| G03 | Pricing source | OPEN_GATE: select official/contracted price source with historical timestamp support and record coverage |
| G04 | Wallet/SDK versions | OPEN_GATE: inspect repo, select compatible versions, pin lockfiles, prove minimal signing path |
| G05 | Live execution | OPEN_GATE: accounts, explicit spend cap, fees, assets and destinations authorized |

All durations use server UTC internally; chain expiry uses canonical milliseconds with checked conversions from block timestamp. UI displays local time plus timezone. Money uses atomic strings, bigint/Rust integers, or exact decimal arithmetic. Never JS Number for balances/prices/calculation intermediates.

## 4. Fresh-source facts and limitations

Checked 2026-11-06:
- Confidential swaps document a normal routing path and an embedded confidential-balance path. This is documentation, not proof this workspace can use either.
- Account history is documented as invite-only. Availability must be tested with an authorized account.
- NEP-171 supplies NFT interfaces; subscription rules and authorization epochs are Keyfolio logic.

Sources:
- https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps
- https://docs.near-intents.org/api-reference/account/get-transaction-history
- https://docs.near-intents.org/api-reference/user-auth/authenticate-user-with-signed-data
- https://docs.near-intents.org/integration/market-makers/confidential-intents
- https://docs.near.org/primitives/nft/standard

Read current endpoint schemas before implementation. Do not infer provider auth headers, pagination guarantees, token TTL, webhook availability, or read-only delegation from sample code. Do not export provider session tokens to followers. Obtain provider confirmation of permitted redistribution where documentation does not establish it; the agent prepares the request but does not send it without authorization.

## 5. Account enrollment and consent

1. B authenticates to Keyfolio using a single-use, domain-bound wallet challenge.
2. B selects/enrolls its confidential account using the provider's supported proof.
3. Adapter verifies the returned source identity; a user-entered address alone is insufficient.
4. B consents to private data processing, public aggregate publication, subscriber disclosure, and retention policy version.
5. Backfill history, read balances, reconcile, and establish coverage_start.
6. Enable listing only when coverage and health are explicit and source access is valid.

Consent includes the fact that the v1 backend can process plaintext authorized data, subscribers can save received information, and public NFTs can reveal subscription relationships. No claim of cryptographic privacy from Keyfolio operators.

Disconnect stops ingestion immediately, invalidates provider credentials as supported, pauses sales, and initiates provider-token deletion. Prior normalized history remains accessible to existing subscribers for their paid duration unless consent is withdrawn; withdrawal disables further disclosure and uses service-termination refunds below. Raw payload retention default: 7 days, encrypted. Normalized account history retention: active service plus 30 days after last license expires, then purge private payloads; retain minimal financial/audit obligations with no trade payload. Final production retention requires owner review before public launch.

## 6. Source capability contract

Adapter MUST expose internal methods: authenticate, getIdentity, getBalances, listActivity(cursor), getExecutionStatus(reference), revokeOrDisconnect. These are internal names, not invented upstream endpoints. Each result includes observation time, source identity, provenance, and capability flags.

Required probes: balance precision; stable event identity; complete pagination; account-wide activity outside Keyfolio; deposit/withdrawal/refund classification; status transitions; restart recovery; key/session expiration; rate limits; revocation; oldest available history.

Coverage values:
- ACCOUNT_HISTORY_COMPLETE: supported activity reconciles for an explicitly stated period, including external-interface tests.
- COMPLETE_SINCE_CONNECTION: verified coverage since connection only.
- KEYFOLIO_ACTIVITY_ONLY: only app-originated activity; requires user acceptance to replace desired account-following scope.
- PARTIAL or UNKNOWN: show gaps; disable complete-account PnL/ranking and new sales.

Do not promise all historical activity before coverage_start. Reconciliation alone may miss offsetting omitted events; combine it with independent controlled-event tests and provider coverage documentation.

## 7. Data pipeline and ledger

Pipeline: encrypted source observations -> normalized immutable events -> atomic asset ledger -> balance reconciliation -> portfolio valuation -> performance snapshots -> public/private read models.

Canonical event fields: source_account_id, source_event_id, revision, type, source_status, occurred_at, observed_at, asset_movements[], fee_components[], provenance, raw_reference, normalization_version.
Types: DEPOSIT, WITHDRAWAL, SWAP, TRANSFER_IN, TRANSFER_OUT, REFUND, FEE, CORRECTION. Unknown movement types quarantine the account; never classify as profit by default.
Atomic unique key: provider + source_account + source_event_id + revision. Corrections reverse/supersede original ledger effects once; raw replay must reproduce the same balances. Persist cursor and event insertion transactionally. Use overlap pagination/dedupe and snapshot reconciliation for concurrent upstream changes.

Trade lifecycle: OBSERVED -> PENDING -> CONFIRMED | FAILED | REFUNDED; unexpected regressions become RECONCILIATION_REQUIRED. Only source-confirmed economic effects enter final ledger. A submitted hash is not settlement. Preserve intermediate states for UI.

For each asset: ending_balance = opening_balance + sum(confirmed asset movements). Compare at aligned observation boundaries; do not compare an old balance to a newer event set. No unexplained atomic-unit difference accepted. Record ongoing unsettled activity separately.

## 8. Performance contract

Equity is the total supported account asset value in USD, with asset ID, amount, price, source, and valuation timestamp. Missing/unpriceable assets make total equity and account-wide PnL incomplete, not zero.
PnL(period) = equity_end - equity_start - external_deposits_USD + external_withdrawals_USD. Transfers between public/private representations inside the declared portfolio boundary are internal movements; classify boundary explicitly to avoid double counting. Fees already reflected in equity are not subtracted twice; externally paid covered fees require separate adjustment and disclosure.

Use time-weighted return only if valuations at cash-flow boundaries are available: compound flow-free subperiod returns. If unavailable, return=null with reason. Never divide net PnL by starting balance as a substitute for cash-flow-adjusted return. Maximum drawdown uses the valid time-weighted wealth index; unavailable index -> unavailable drawdown.

v1 public metrics: net PnL, valid return, valid maximum drawdown, settled swap count, coverage_start/end, snapshot time, coverage label. No win rate, Sharpe, realized/unrealized split, or fabricated annualization in v1. Historical prices must correspond to event times; current price cannot silently replace historical prices.

New profiles show insufficient history. Underlying source gaps freeze the last valid snapshot and label it stale. Discovery default sorts newest active profiles; performance sorting includes only profiles with comparable complete window coverage. Display tracked performance, not verified/proven PnL, unless a separate attestation mechanism has actually been established.

## 9. Access NFT and contract model

One contract manages trader plan versions, NFT licensing, purchase receipts, deferred revenue, and refunds. Implement NEP-171 and NEP-177 with a maintained compatible standard library. Additional methods provide entitlement and billing views. NEP-178/181 only if needed by selected wallet/listing support; record decision. No custom substitute for standard transfer callback behavior.

License fields: token_id, owner_id, trader_id, source_binding_id, issued_at_ms, expires_at_ms, plan_version, scope_set, access_epoch, disabled_reason. Token IDs are unique receipt-derived IDs. No provider secret or private trade data on-chain. Source binding is an opaque ID; profile linking can still expose subscription relationships and must be disclosed.

Purchased plan terms are immutable. New plan version changes future purchases/renewals only. Disabled license status cannot be used by admin to confiscate paid rights without refund policy. Emergency pause prevents new sales and unsafe actions; it does not grant admin withdrawal of customer liabilities.

State of access is derived, not a cron flip: enabled && now < expires_at && current owner matches auth && source disclosure enabled. Metadata is descriptive; backend uses authoritative entitlement state. NFT remains as an expired receipt after expiry; it may be transferred, but grants no access until valid renewal.

Ownership transitions increment access_epoch, including transfer_call tentative transfer and return to sender. Track pending transfer resolution and deny API access while pending; add gas/timeout recovery tests so callback failure does not silently unlock access. Codex must review the standard library path and callback failure behavior. Transfer approvals alone grant no API rights. If transfers lock any billing mutation, scope the lock to that token and provide tested recovery.

## 10. Subscription payment and service termination

DEFAULT commercial model: exact-price, single-FT subscriptions; zero platform fee; prepaid revenue vests linearly over the license term in chain time. This is a planning default chosen to make cancellation refunds funded, not an existing implementation.

Each purchase/renewal creates a billing tranche: id, token_id, start_ms, end_ms, gross_atomic, withdrawn_atomic, cancelled_at. Renewals append a tranche starting at max(now, prior expiry). No automatic billing.
earned_atomic(t) = floor(gross_atomic * clamp(t-start, 0, end-start) / (end-start)). Use overflow-safe widened integer math. At end, earned=gross. Trader claimable = earned - already withdrawn. Unvested funds remain contract liabilities. NFT transfer moves future refund entitlement with the NFT; disclose this on transfer.

Purchase preconditions: allowlisted FT predecessor; exact atomic amount; positive published price; registered active trader; known plan version; unique (payer, purchase_id); buyer is NFT recipient in v1; enough explicitly prepaid NFT storage. Validate before mutating. Invalid or replayed FT transfer returns full unused amount through standard resolver. Never mint twice or retain replay funds. Pre-register storage via separate native-deposit action; display storage funding separately from FT subscription price.

Source health is off-chain. A declared service-monitor account may pause sales and terminate a trader service epoch after 24 continuous hours without usable authorized data, or immediately when B explicitly withdraws consent. This account cannot choose refund recipients, price, payout amounts, or transfer trading funds. Its availability attestation is a disclosed trust assumption. Monitor failure remains an operational risk; do not claim autonomous uptime enforcement.

Termination records a cutoff timestamp, disables future sales and access, freezes earnings at cutoff, and permits current NFT owner to claim total unvested remainder. Pause transfers of that NFT while a refund is pending. Process tranches in bounded batches; claims remain resumable. Customer voluntary cancellation is not prorated in v1; it stops renewal intent only (there is no auto-renew).

FT payout is asynchronous. Reserve payout amount before call; finalize on success; restore on failure in a private callback. Duplicate callbacks cannot double-credit or double-pay. Contract invariant: settled subscription funds = successful trader payouts + successful refunds + pending payouts + remaining liabilities/credits. Native storage deposits accounted separately.

The monitor is the only availability oracle in v1. Public paid launch requires user acceptance of this refund/vesting default and monitor authority; local/sandbox implementation can proceed with it. Do not silently switch to upfront irrevocable payouts to meet a date.

## 11. Authentication and private API

Wallet login challenge: random 32-byte nonce, 5-minute TTL, domain, network, account, intent=keyfolio_login, issued_at, expires_at, server-generated challenge ID. Use the exact supported wallet-signing standard chosen in KF-00 and verify actual account key control; account string plus signature without binding is insufficient. Atomic nonce consumption prevents replay. Login signature never authorizes a trade.

Browser uses secure HttpOnly SameSite session cookies and CSRF protection for mutations. API credentials are random 32-byte secrets displayed once, stored as salted keyed hash/secure token hash with credential ID. Bind to network + NFT contract + token_id + wallet + scopes + access_epoch. Credentials cannot outlive the license. Renewal does not resurrect expired/revoked credentials.

Every private request checks credential, owner, network/contract, trader binding, expiry, epoch, scope, quota, and source disclosure status. Current NFT observation must be <=30 seconds old using monotonic cache age; otherwise fetch final state or fail closed. Cache keys include authorization context; no public/CDN caching of private responses. Poll active ownership every <=10 seconds when quotas permit. Stream delivery omitted in v1; dashboard polls paginated feed.

Endpoints (internal REST contract, not upstream routes):
| Method/path | Auth and result |
|---|---|
| GET /v1/traders | Public profiles and valid aggregates only |
| GET /v1/traders/:id/performance | Public snapshot + coverage/freshness |
| POST /v1/auth/challenge | Rate-limited challenge |
| POST /v1/auth/verify | Single-use signature -> session |
| POST /v1/trader/connections | Trader owner; initiate permitted upstream auth |
| DELETE /v1/trader/connections/:id | Owner; disconnect and terminate per policy |
| GET /v1/me/licenses | Authenticated owner's indexed licenses + chain freshness |
| POST /v1/me/api-credentials | Owner with active NFT; limited scopes |
| DELETE /v1/me/api-credentials/:id | Credential owner; idempotent revoke |
| GET /v1/traders/:id/activity | Active matching NFT; cursor pagination |
| GET /v1/traders/:id/positions | Active matching NFT; source snapshot time |
| POST /v1/copy-quotes | Active matching NFT + authenticated follower; fresh quote |
| POST /v1/copy-orders | Persist user-approved quote reference; cannot sign for user |
| GET /v1/copy-orders/:id | Order owner only |

Response envelope: data, meta{request_id, observed_at, coverage, stale}, error{code,message,retryable}. Cursor opaque, page limit default 50/max100. Numeric money strings only. 401 invalid authentication, 403 missing/wrong license or scope, 409 conflicting/stale state, 422 invalid parameters, 429 quota, 503 upstream or authorization freshness unavailable. No sensitive account-existence leakage in unauthorized errors.

## 12. Assisted copy

Only confirmed spot swaps with a currently supported route. User chooses input amount; backend returns new quote bound to follower account, chain, input/output assets, amount, minimum received, fee, slippage, deadline, recipient, refund destination, and source trade ID. All fields shown before signature. Slippage default 0.5%, UI max 2% in v1; reject provider route if user limit cannot be honored. No automatic signature and no execution from read-only API credential.

Follower proves control of recipient/refund wallet used by the route; no arbitrary pasted destination in v1. Source trader credentials are never used. NFT ownership does not supply execution authority. Submission must use provider-supported signed intent or wallet transaction flow, verified during feasibility.

Order state: CREATED -> QUOTED -> AWAITING_USER -> SUBMITTED -> SETTLED | REFUNDED | FAILED. EXPIRED before submission; UNKNOWN after ambiguous submission requires status recovery, never blind resubmit. Idempotency key scoped to follower; same key/different payload rejected. Expired license blocks new quotes/submissions; existing submitted orders remain readable and recoverable by owner. Performance of follower and trader stored separately.

## 13. Repository and runtime baseline

Reuse a compatible existing repo. Greenfield DEFAULT: pnpm TypeScript workspace; Next.js web; Fastify API; Node worker; PostgreSQL; Rust near-sdk contract; shared validation schemas. Pin tested versions at bootstrap, not speculative latest strings. Tests: unit/integration for API/ledger, NEAR sandbox for contracts, Playwright for browser flows. WSL/Linux for contract tooling if native Windows cannot run required sandbox binaries. Do not change system PATH globally to work around project setup.

Proposed layout:
apps/web; apps/api; apps/worker; contracts/access; packages/domain; packages/provider-adapter; packages/api-contract; docs; scripts; tests/e2e.

SQL migrations: users, wallet_links, trader_profiles, source_connections, consent_versions, plan_versions, purchases, licenses_projection, credentials, raw_observations, ledger_events, balance_snapshots, price_observations, performance_snapshots, copy_orders, audit_events, worker_cursors. Unique constraints enforce idempotency. Persist network in all chain identities.

Single API deployment initially. Distributed quotas/locks use PostgreSQL atomic operations; add Redis only if measured load requires it. Schema/API contract written before concurrent frontend/backend workers. No simultaneous migration ownership.

## 14. Screens and observable behavior

Discover: profile, account coverage, newest valid snapshot, duration, price. Profile: aggregate chart, data coverage, package terms, privacy note, purchase action. Checkout: token/network, price, storage fee, term, refund policy, pending/success/error. My Keys: trader, remaining term, renewal, transfer and warning about data already downloaded. Private Account: balances, chronological activity, source health, copy buttons only on eligible trades. API Access: credential creation/revoke, scope, quota, curl example with placeholder only. Trader Studio: connection/consent, sync state, profile/price, subscribers count, vested/unvested earnings, withdrawal. Activity: purchase/copy/refund status.

Every screen needs loading, empty, denied, expired, stale, upstream-error, and retry behavior relevant to its data. Public screens must never briefly render private data before hiding it. Show exact network and LIVE/TESTNET/FIXTURE environment visibly. UI language default English; coordinator updates to user Indonesian.

## 15. Operational minimum

Separate secrets per environment, least privilege, encrypted upstream tokens, sanitized logs, HTTPS public deployment, private database, migration backup, database restore drill, worker cursor recovery. Metrics: ingestion lag, reconciliation errors, RPC freshness, revoked access violations, queue age, failed/pending payouts, stale price coverage. No claims of audited/production-ready security without actual review.

Circuit breakers: stale NFT state denies private access; stale prices disable affected totals; incomplete source data pauses sales; contract pause preserves refund/payout recovery. App restart does not reset pending actions. Demo credentials/data isolated from real customers. Document subscription relationship leakage and operator trust.

## 16. Scope-change ownership

Codex can change file layout, compatible library choices, test internals, batching, and implementation sequencing with a recorded reason. User decision required for narrower account scope, removal of assisted copy, nontransferable NFTs, new custody authority, changed refund rights, introducing a paid provider, mainnet spending, or skipping a release-critical test. When a dependency blocks, progress on independent tasks and show the exact missing capability.

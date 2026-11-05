# KF-01 official access research

Researched2026-11-06. Status:BLOCKED_EXTERNAL. No trader test account selected; no history invitation confirmed. Research is not S01-S08 authenticated acceptance. No provider messages, registration, signatures, transactions or repeated unauthenticated API probes performed.

## Verified sources and limits

| Source | Supported fact | Not established |
|---|---|---|
| [Authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication) | Partner credentials identify integration; private reads need an owner-authorized User-Session | History entitlement, read-only delegation, subscriber reuse rights |
| [History](https://docs.near-intents.org/api-reference/account/get-transaction-history) | Invite-only, public/confidential history and cursor pagination | Invitation granularity; full account ledger or all originating apps |
| [Owner proof](https://docs.near-intents.org/api-reference/user-auth/authenticate-user-with-signed-data) | Empty-intent proof; NEAR uses NEP-413 and registered key; versioned nonce | Specific test environment readiness or least-privilege token scope |
| [Account abstraction](https://docs.near-intents.org/integration/verifier-contract/account-abstraction) | Named account key registration is separate from wallet connection; registered keys carry account control | A new server key being necessary or safe for Keyfolio (it is not authorized) |
| [Balances](https://docs.near-intents.org/api-reference/account/get-user-token-balances) | Authenticated private balance endpoint | Complete historical event coverage |
| [Going Live](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/going-live) | Official support link points to [Telegram community](https://t.me/near_intents) | A history-specific self-service invitation form or SLA |
| [Explorer API](https://docs.near-intents.org/integration/distribution-channels/1click-api/explorer/introduction) | Historical1Click swap analytics | Substitute for a confidential account ledger |

The [Partner Dashboard](https://partners.near-intents.org) is the documented partner-key route. Its live page fetch timed out during research; dashboard forms/login were not inspected. Do not invent its fields or claim an access request was submitted.

## Terms gate

[API Terms](https://docs.near-intents.org/security-compliance/terms-of-service), updated2026-10-07: sections2.7/2.9 allow KYB/eligibility conditions and developer approval for confidential swaps; history invitation granularity remains unspecified. Sections4.1(a)/(e) restrict API wrappers, standalone data commercialization and retention beyond24h, with a static-history exception. Sections20.2/20.4 provide agreement/contact routes. Potential conflict with Keyfolio paid subscriber API and proposed retention is an inference requiring provider confirmation, not a final legal conclusion. Trader consent alone does not establish provider permission.

## Answers to the access questions

1. **Integrator or per account?** Separate partner identity and owner session are documented. The additional history invitation may attach to partner, account, or both; ask explicitly. Creating a partner key must not be treated as history approval.
2. **Request/allowlist?** Invite-only status is explicit, but no history-specific public onboarding procedure was found in the inspected official pages. Recommended routing: Partner Dashboard for integration identity; official support community for introduction to the1Click/Confidential account API owner; private approved channel for application details and written permission. Solver private-relay onboarding is a different product path and must not be assumed necessary for account reads.
3. **Requirements?** Prepare accurate product identity, repository, intended data scopes, user-signing flow, handling/retention, test use and expected load. Ask the provider which are mandatory. Published sources do not establish a universal history minimum volume, price, approval deadline, callback-domain allowlist or eligibility checklist. No production entity/KYB status has been asserted for Keyfolio.
4. **All account activity?** Not proven. Request a coverage matrix for swaps, direct transfers, shield/unshield, deposits, withdrawals, fees, refunds, corrections, failures and pending states, including direct SDK/other UI actions. Ask earliest history, gaps, raw atomic amounts, immutable event IDs and final execution/confirmation timestamps. A swap-shaped response is not proof of an accounting-complete account feed.
5. **Subscriber disclosure?** Not approved. Request written treatment of paid NFT-gated UI/API, public derived performance, downloaded history, retention and deletion. Identify any agreement/exception required. Do not silently redesign into app-only tracking or remove API access to avoid this question.

## Recommended application steps (not yet executed)

1. User reviews the draft in `docs/provider-access-request.md`; send only after explicit user authorization, or user sends it directly.
2. Approach official support for the owner of account-history invitations; use Partner Dashboard if requested. Initial inquiry needs no secret or funded account. Request suitable nonproduction testing before selecting network/account.
3. Get written answers to the two feasibility gates first: intended account coverage and permission for Keyfolio's exact disclosure/API model. If unsupported, record the limitation and obtain user decision rather than narrowing scope.
4. Obtain environment endpoints, network/chain IDs, verifier/signing recipient, SDK version, invitation scope, session policy and rate limits. Do not copy production constants into a hypothetical staging system.
5. User selects B and negative-control A in the approved environment; user signs in wallet. Any key registration, funding or trade requires separately reviewed network, action, destination, amount and fee authorization. No key export/server signing key.
6. Run authenticated read/refresh/revoke, stable pagination and controlled external-interface activity tests. Store only permitted, sanitized evidence; actual account payload retention must be settled first.
7. Advance KF-01 only on observed access, verified identity, coverage and recorded permission; invitation or provider email alone is not live acceptance.

## Test accounts and environments

| Environment | Accounts/config needed | Evidence it can establish |
|---|---|---|
| Local FIXTURE | Synthetic B/A/C identities, PGlite/private test DB, NEAR sandbox accounts | Logic, auth boundaries, ledger/contract invariants; no real source access |
| Provider-approved nonproduction | Provider-specified network/accounts/assets and account-history permissions; B/A controlled by user | Only capabilities actually offered there; testnet support currently UNKNOWN |
| Production (only if necessary and authorized) | Dedicated low-balance B for source; separate A for negative control/copy; C for NFT transfer; exact network config | Real provider reads; real economic tests need separate spend/fee limits |

Prefer a dedicated named NEAR B with wallet NEP-413 support, aligned with v1. A wallet login alone does not establish its confidential balance identity. User signs the provider's reviewed empty proof in wallet; server receives the resulting session through the local application flow, encrypts it and never displays/logs it. User does not paste session tokens in chat.

NFT sandbox/testnet B/A/C can be separate from provider accounts, but mixed-network tests remain partial integration. Do not label production Confidential Intents as testnet because its operator wallet is for testing. Need small usable balances for later controlled movements/copy, not for an initial invitation inquiry. Determine funding only after provider environment and user budget are approved.

## Minimum information to request from provider

Integration/partner identifier to allowlist; whether B/A account IDs must also be listed; app-origin/callback requirements; nonproduction availability; session expiry/refresh/revoke and true permission scopes; account coverage/time/amount schemas; commercial/data handling approval; fees and rate limits. Use authenticated private channels for identifiers the provider considers sensitive. Never send provider JWT or User-Session secrets in community chat.

## Acceptance evidence still missing

S01-S08 remain NOT_RUN/BLOCKED_EXTERNAL: no authorized B identity mapping, private balances, paginated history, outside-Keyfolio trade, lifecycle/revocation or permission test completed. Local implementation may continue independently. No new unauthed probes were used as substitutes.

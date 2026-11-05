# KF-01 initial capability report

Date: 2026-11-06. Classification: BLOCKED_EXTERNAL for authenticated account access. This is Codex's initial pre-dispatch research, not accepted S01-S08 evidence.

## Observed, nonfinancial HTTP probes

Node fetch, no credentials, GET only, timeout15s, response bodies not persisted:

| Endpoint | HTTP | Conclusion |
|---|---|---|
| https://1click.chaindefuser.com/v0/account/balances | 401 | Reachable; authorized account read NOT_RUN |
| https://1click.chaindefuser.com/v0/account/history | 403 | Reachable; account/history permission not established |

These statuses alone do not diagnose which credential/permission is missing. No wallet signature, authenticated request, quote, spend or message to a provider was performed.

## Current official documentation

- [History](https://docs.near-intents.org/api-reference/account/get-transaction-history): invite-only paginated account history. The document distinguishes older-page prevCursor from newer-poll nextCursor. No completeness assumption is accepted without controlled tests.
- [User authentication](https://docs.near-intents.org/api-reference/user-auth/authenticate-user-with-signed-data): account owner signs an empty intent for a User-Session token. Its signing/nonce semantics differ from Keyfolio's login challenge; actual account proof is still NOT_RUN.
- [Authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication): confidential reads use a User-Session bearer token, separate from the integration Partner JWT. Refresh flow is documented; actual expiry, revocation and scope remain untested.
- [Documentation index](https://docs.near-intents.org/llms.txt): balances reference is named get-user-token-balances. A guessed get-balances documentation page was unavailable; use the index, not invented routes.

## Capability matrix

| Field | State | Evidence needed |
|---|---|---|
| B ownership and source binding | UNKNOWN | Authorized wallet proof plus returned verified identity |
| Private balance precision/assets | UNKNOWN | Authenticated response reconciled to account |
| History invitation/access | BLOCKED_EXTERNAL | Account/integration with history permission |
| Account-wide external-interface activity | UNKNOWN | Controlled outside-Keyfolio event and coverage documentation |
| Stable event IDs/revisions/pagination | UNKNOWN | Multiple pages, overlap/new arrivals, replay |
| Deposit/withdraw/refund/failure coverage | UNKNOWN | Independently recorded controlled events |
| Trusted source execution/confirmation time | UNKNOWN | Semantic provider proof; createdAt alone insufficient |
| Token refresh/revoke/read-only scope | UNKNOWN | Authorized lifecycle probes; never guess read-only delegation |
| Redistribution rights | BLOCKED_EXTERNAL | Applicable permission/terms covering paying subscribers |
| Automated health and24h outage | NOT_RUN | Valid idle-account observations plus local clock tests |

## Exact unblock requirement

An authorized trader account signing route, access to its User-Session lifecycle, history invitation/permission, and evidence of permitted subscriber redistribution. Configure secrets locally; do not send wallet keys or bearer tokens in chat. Partner JWT alone does not establish private account access. If registration requires a transaction, separately establish account/network/signing authority before performing it.

Continue independent local schemas, exact-money/health/copy-time tests and contract sandbox work after C00. Do not narrow account-following to app-only tracking.

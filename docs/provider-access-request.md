# Confidential account history access request — UNSENT

Prepared2026-11-06 for user review. No message has been sent. This draft is an integration inquiry, not a claim of approval, deployed product, customers or committed volume. Replace bracketed fields only with verified information.

## Routing

Start with the [official support community](https://t.me/near_intents), linked by the [Going Live guide](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/going-live), and ask for the responsible1Click/Confidential account API contact. The [Partner Dashboard](https://partners.near-intents.org) is the documented integration-key route; a key does not itself prove history invitation. For permission/contract interpretation, request the appropriate contact using [Terms section20.4](https://docs.near-intents.org/security-compliance/terms-of-service). Do not submit technical secrets to a public group.

## Short introduction

Hello NEAR Intents team — we are developing Keyfolio, a trader-authorized account analytics product on NEAR. We would like to request access to the invite-only Confidential Intents account history API and confirm whether our intended account coverage and subscriber data use are supported. Could you direct us to the team responsible for account-history invitations and the appropriate private application channel? Repository: https://github.com/EndPx/keyfolio. We have not selected a test account or obtained history access yet.

## Detailed inquiry

Subject: Keyfolio — request for Confidential Intents account-history access and permitted data use

Hello NEAR Intents /1Click team,

We are building Keyfolio: a trader explicitly authorizes us to observe one Confidential Intents account. The planned product publishes consented aggregate performance and grants time-limited, NFT-gated access to normalized account history/positions through a dashboard and our own API. We plan to support manually confirmed assisted copy using each follower's separate wallet and funds. We do not request trader signing keys or share provider session credentials with followers.

The project is at local implementation stage, with no paid public launch. Our target is account-following, including supported activity initiated outside Keyfolio, rather than only trades our application originates.

Could you help us establish:

1. **Invitation scope and application:** Is `/v0/account/history` access approved per partner/integration, individual source account, both, or another identifier? What request/allowlist process applies, and which application details and eligibility checks are required?
2. **Environment:** Is an approved staging/testnet environment available for owner authentication, private balances, history and controlled swaps? Please provide the supported network, API/contract configuration, test assets and account setup requirements. If only production is supported, please confirm that before we propose funded tests.
3. **Coverage:** Does history include all supported activity of the authenticated account across other UIs and direct SDK/contract actions, or only1Click-originated/partner-attributed swaps? Please specify swaps, transfers, deposits/withdrawals, shield/unshield, fees, refunds, failed/pending actions and corrections, plus oldest available history and known gaps.
4. **Accounting and timing:** Which fields provide immutable event identity/revisions, exact atomic asset movements and final execution/confirmation timestamps? We must prevent old backfilled trades from becoming eligible for copy and reconcile movements against balances.
5. **Sessions:** Is a genuinely read-only, revocable account-observation scope supported? How are owner proof, expiry, refresh, revocation and account binding verified? Please confirm required partner and owner-session headers without sending credentials through this conversation.
6. **Permitted product use:** With explicit trader consent, can we provide paid NFT-gated history/positions, subscriber API access and public derived performance? Which agreement or written approval covers this exact model?
7. **Storage:** Please confirm permitted raw-data retention, normalized history, derived snapshots, backups, subscriber downloads and deletion after withdrawal of consent. We can share our proposed policy for review; it is not yet applied to real provider data.
8. **Operations:** What account/partner rate limits, polling cadence, quotas, fees and incident/support process apply? We will back off and will not run unapproved financial actions.

Project: Keyfolio
Repository: https://github.com/EndPx/keyfolio
Contact: [your preferred contact]
Partner/application ID: [not created/confirmed yet — fill only when available]
Test trader account/network: [not selected — awaiting environment guidance]
Expected initial usage: a controlled development pilot; no claimed production volume

We would appreciate written answers about coverage and permitted subscriber use before onboarding accounts. The account owner will sign through their wallet; no private keys or bearer tokens need to be sent in messages.

Thank you,
[your name / team]

## Provider answer checklist

Record responder/channel/date and applicable agreement/version; exact invitation identifier; environment/config; account setup; coverage matrix; event/time/precision semantics; session scope/revoke; permitted disclosure/retention; rate/fee limits. Do not turn an informal invitation into acceptance of unconfirmed product rights. Keep any private correspondence outside the public repository and promote only approved sanitized findings.

# Keyfolio mainnet readiness plan

Status: planning only. No mainnet deployment, funding, signing, or paid launch is
authorized by this document. The execution order remains testnet first.

## Gate 0 — product, access and authority

Before a mainnet action, the owner must explicitly choose the signer/wallet,
spending limit, deployment target, and launch scope. The paid customer policy for
vesting, service termination and refunds must be accepted for public use; the
local default is not approval for a public launch.

The following external gates must be closed with evidence:

- **G01 Confidential Intents:** an authorized trader account, invitation/session
  scope, account-wide history coverage including supported external interfaces,
  source execution/confirmation timestamps, subscriber-use/retention permission,
  and provider limits/SLA. Account-following remains required.
- **G02 payment FT:** the selected NEAR FT contract, metadata, registration,
  storage, treasury funding and refund liquidity are available on testnet first.
- **G03 valuation:** a NEAR-first price source has the asset mapping and historical
  boundary coverage needed by PnL/TWR/drawdown. Missing history keeps metrics
  incomplete; it is never replaced with a current-price guess.
- **G04 wallet:** the selected NEAR wallet passes login challenge, transaction
  signing, rejection, redirect, reload and recovery tests. Wallet ownership is
  verified server-side; UI connection alone is not proof.
- **G05 financial/deployment authority:** the user approves real-asset testnet or
  mainnet spending and the exact deployment/signing steps. No private key or token
  is placed in chat or the repository.

## Gate 1 — close the testnet journey

Use dedicated testnet accounts and explicit `TESTNET` configuration. Complete and
record final receipts, block/finality context and contract views for:

1. access-contract deploy/init/plan and FT metadata/register/storage;
2. purchase through the real NEP-141 resolver, NFT ownership and entitlement;
3. transfer, epoch/expiry, renewal and pending-transfer recovery;
4. linear vesting, payout reservation, successful callback and failed callback
   restoration;
5. termination at start/mid/end with the contract acceptance timestamp as cutoff,
   positive refund and repeated-termination idempotency;
6. supply, storage-stake and liability conservation under the exact atomic amount
   rules; and
7. wallet rejection, transport timeout, ambiguous redirect and reload recovery.

The browser must show the correct `TESTNET` banner and never serve fixture data.
`PASS_LOCAL` or Sandbox evidence cannot be promoted to testnet evidence.

## Gate 2 — production rehearsal and mainnet deployment review

Freeze the reviewed contract WASM and ABI, record hashes and initialization
parameters, and complete an independent contract/security review. Prepare the
production configuration with `KEYFOLIO_MODE=LIVE`, `NEAR_NETWORK=mainnet`,
mainnet contract identities, a production PostgreSQL target, and provider secrets
injected through the deployment secret store. LIVE must fail closed when any
required value is missing; it must never fall back to fixtures.

Confirm operational controls before deployment:

- encrypted provider/session storage and hashed API credentials;
- HTTPS, trusted-origin/CSRF policy, rate limits and audit logging without raw
  source payloads or secrets;
- health based on read access, observation freshness and account-data validity;
  a readable idle account remains healthy;
- copy eligibility based on trusted source execution/confirmation time, with
  untrusted time disabling copy;
- backups, restore rehearsal, cursor recovery, contract receipt reconciliation and
  incident contacts; and
- a funded contract reserve for unvested liabilities, payouts and refunds without
  relying on an unfunded retroactive outage promise.

## Gate 3 — controlled mainnet canary

Only after the user approves the exact transaction plan, deploy the frozen WASM to
the selected mainnet account and verify code hash, owner, plan, FT and monitor
configuration from finalized state. Run one small internal canary with a designated
wallet and a pre-agreed amount. Verify purchase, entitlement, payout and refund
receipts, then reconcile contract liabilities against the database projection.

Keep new sales behind an allowlist while the canary is observed. Do not use the
canary to claim live Confidential Intents coverage or full account-following until
G01 evidence exists.

## Gate 4 — gradual launch and rollback

Expand from internal allowlist to a small invited cohort, then public launch only
after the canary and monitoring window meet the agreed thresholds. New sales can be
paused without revoking existing NFT read rights. A provider outage or consent
withdrawal blocks new sales and copy; it does not terminate a readable idle trader.

For service termination, the cutoff is the block timestamp when the contract accepts
the termination transaction. The outage start is not an automatic retroactive refund
boundary. Preserve solvency and do not create a refund obligation for funds that are
no longer available.

Rollback means pausing new sales, reverting web/API release, preserving durable
operation IDs and reconciling finalized chain state. It does not rewrite finalized
contract state or resubmit an ambiguous transaction blindly.

## Current position

As of 2026-11-09, local build/test and read-only browser evidence are green, but the
project is not mainnet-ready. G01, G02, G03, G04 and G05 remain open in
`docs/status.md`; no mainnet action should be scheduled until the corresponding
evidence and user authorization are present.

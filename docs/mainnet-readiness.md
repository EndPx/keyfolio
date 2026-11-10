# Keyfolio mainnet readiness

Status: **MAINNET-DIRECTED / BLOCKED_EXTERNAL**

Keyfolio is now being prepared for a controlled production pilot. This document separates what can be completed locally from what requires provider access, user-selected accounts, wallet signing and real-asset authorization.

## Product claim we are targeting

The target claim is:

> A trader can authorize account-following over a production Confidential Intents account; a follower buys time-limited access, reads the permitted history and public performance context, and may submit assisted-copy trades using only the follower's own funds and limits.

This claim requires production Confidential Intents access. Local fixtures, Sandbox contracts and NEAR testnet do not prove the private source history or confidential execution path.

## Gate order

| Gate | Evidence required | Current state |
|---|---|---|
| G01 provider access | Invitation or documented integrator onboarding, account-history scope, external-interface coverage, timestamp semantics, subscriber reuse/retention terms | `BLOCKED_EXTERNAL` |
| G02 trader source | Dedicated public account ID, consent/session path, readable source account and history | `BLOCKED_EXTERNAL` |
| G03 wallet path | User-selected wallet, challenge/signature, account ownership and recovery proof | `PASS_LOCAL` seams; production signing `NOT_RUN` |
| G04 payment/access | Mainnet payment asset and route, access contract deployment, NFT entitlement, expiry/revocation and refund proof | Sandbox/local only; mainnet `NOT_RUN` |
| G05 copy execution | Quote/order adapter, trusted source execution time, follower signature, owner cap, status/recovery and no-custody proof | `NOT_RUN` |
| G06 operations | monitoring, outage/termination cutoff, key rotation, rollback/recovery, evidence retention | local policy/tests only |

## Mainnet pilot boundary

The first pilot must use a dedicated trader account and a dedicated follower account selected by the user. It must have an explicit spending limit, a small approved budget, an approved payment asset, a rollback/recovery procedure and a stop condition. No private key, seed phrase or bearer token is ever entered in chat or committed to the repository.

The pilot is not authorized yet. Before any mainnet deployment or transaction, the user must provide the public account IDs and authorize the exact signing route, funding amount and destination contracts. Provider outreach also remains unsent until the user authorizes it.

## Local work that remains valid now

- finalize API, auth, entitlement and recovery boundaries;
- keep the access contract and payment flow reproducible in Sandbox;
- verify exact integer money and refund/termination invariants;
- finish assisted-copy quote/order state machines with synthetic adapters only in `FIXTURE`;
- prepare production configuration validation that fails closed when a required mainnet identity or provider permission is absent;
- prepare a runbook and evidence manifest for the pilot.

## Evidence rule

`PASS_LOCAL`, `PASS_TESTNET` and `PASS_LIVE` remain separate. A testnet contract receipt does not prove a mainnet deployment. A public RPC read does not prove Confidential Intents private history. A fixture trade does not prove live copy execution. The release package must link the exact network, account, contract, provider scope and evidence for every live claim.

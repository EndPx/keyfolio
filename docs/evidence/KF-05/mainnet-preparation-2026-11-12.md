# Mainnet account and funding preparation

Date: 2026-11-12, Asia/Jakarta. Classification: `PASS_LOCAL` account preparation and `READ_ONLY_MAINNET` protocol observations. Deployment: `NOT_RUN`. Final reviewed Wasm: **NOT AVAILABLE / REVIEW REQUIRED**.

## Isolation and account roles

The user supplied the public funding account `dc634c505ee6b86a9b615ed7ebef7fff6a235c3406163d35d4f0e60c576a27b5`. It is funding-only, shared with another project. It is not the Keyfolio contract, operator, trader source, follower, or monitor.

Three independent Ed25519 keypairs were generated locally for Keyfolio only:

| Role | Proposed implicit account ID | Public key | State |
|---|---|---|---|
| Access contract / deployment signer | `ae42783445bbed99eba204c0215502b2b9d9ff0ba237911f8936993f1196cafa` | `ed25519:CjEj5JEdotD6355xXxTFvyRGCBwgkhdAgV7wK4VnfrAD` | Local identity, not activated/funded |
| Operator / contract owner | `b1647a974bd36cd391a14b58de3914c685ad9445b20ec900ed8bf83fcd6eea3a` | `ed25519:CwU2YEgLzmk4E2ACEU541SFk8DKt27CNoYbqi9PvUfK7` | Local identity, not activated/funded |
| Service monitor | `3716a21a3832ae78155dee87bd47b679b5aaa911ac3d5d3ca0a56993d4a9558d` | `ed25519:4i3SYBkcTx1N2aERcdnwCQ1ifPqNUUAA4yya3y1aPYHJ` | Local identity, not activated/funded |

Keys are stored only at `.deploy-local/keyfolio-mainnet/keys/{access-contract,operator,monitor}.json`. This directory is gitignored and its Windows DACL was restricted to the current local user. Public manifest: `.deploy-local/keyfolio-mainnet/public-identities.json`. Private material was never printed. No global keychain, funder credential, ShowStake directory, credential, contract, or account state was opened or modified. Re-running preparation preserves these identities instead of rotating them.

The contract account's own deployment key is separate from the owner/operator account and monitor. The contract deployment key remains an upgrade authority until a separate reviewed key-retention decision; it must not become an application/backend trading key. The monitor's financial recipient/amount authority is limited by contract methods, but its full-access account key should remain offline until a restricted runtime key is explicitly configured. No key-registration transaction was submitted.

Implicit accounts are chosen to avoid registrar/name availability and cannot be created as subaccounts of the supplied 64-character funding ID. Activation would require later approved transfers; local key generation alone creates no on-chain account.

## Mainnet observations

Endpoint: `https://rpc.mainnet.near.org`; chain ID checked as `mainnet`. Snapshot observed `2026-11-11T18:53:20.609Z` (2026-11-12 WIB), finalized block height **224104440**, hash `41jRnFCfvxEt6iCJX75RC5CK8xUvaQ5wrcC1vCTasMMj`, protocol **88**.

| Value | Observed value |
|---|---|
| Storage stake price | `10000000000000000000` yoctoNEAR/byte, or 0.00001 NEAR/byte |
| Block gas burn price | `100000000` yoctoNEAR/gas, or 0.0001 NEAR/TGas |
| Minimum gas purchase price | `1000000000` yoctoNEAR/gas, or 0.001 NEAR/TGas |
| Account creation charge | `7000000000000000000000` yoctoNEAR, or 0.007 NEAR |
| Funder view | `UNKNOWN_ACCOUNT` at this finalized block; available balance could not be verified |

`UNKNOWN_ACCOUNT` is a point-in-time provider response, not an assumption about whether the user controls the corresponding wallet or whether it may be activated later. No transaction or signature was submitted. Do not fund project identities until the funding account is active and its spendable balance is checked again during an exclusive funding window.

Storage is locked balance, gas burn is spent, prepaid gas is a temporary liquidity requirement. The new-account charge is withheld from the gas-price-difference refund according to current protocol rules; do not count it twice as both a separate outgoing transfer and gas. Use `max(current gas price, minimum gas purchase price)` for upfront call-gas liquidity. A static cost table using only the gas burn price understates the required balance.

## Candidate artifact, not a deployment approval

`contracts/access/target/wasm32-unknown-unknown/release/access.wasm`:

- size: **582,307 bytes**;
- SHA-256: `80D1340207C7E14C0162C5D63D4374E58C58C0C67DB0890C18C1E4F825ADF9CF`;
- contract version in source: `kf-05c-wip`;
- last access-contract source commit: `f7ec03f7c5c195e9ad8dcb80b7672a99bd87a761`;
- `cargo build --locked --release --target wasm32-unknown-unknown` completed; candidate hash remained unchanged;
- `cargo test --locked --lib`: **26/26 PASS**, with existing test-only warnings.

Historical Sandbox evidence records a different Wasm hash. The existing Windows artifact therefore cannot inherit that binary's acceptance automatically. Same-artifact deployed-Wasm measurements and independent security review are required before final funding totals.

Coordinator verification also checked the public-key-to-implicit-account mapping for all three roles, distinctness from each other and the funder, exact integer budget arithmetic, current Wasm hash equality, absence of private-key/session fields in public JSON, and disabled broadcast/final-funding flags. Result: `PASS_LOCAL`. The sanitizer reads only public identities, source/binary files and public RPC configuration; it does not read any credential store.

## Candidate budget in NEAR

All calculations use integer yoctoNEAR. Numbers below are a reproducible planning envelope for the present candidate, **not a final reviewed-Wasm funding request**.

| Item | Calculation | NEAR |
|---|---|---:|
| Code bytes storage stake component | 582,307 bytes x 0.00001 | **5.82307** |
| Initial state reserve | assumed 16,384 bytes x 0.00001, not yet measured | 0.16384 |
| Account/access-key reserve | assumed 182 bytes x 0.00001, conservative, no free-storage allowance deducted | 0.00182 |
| Growth/callback headroom | provisional policy reserve | 0.25 |
| Deploy action + receipt gas, self-deploy | 42,154,184,810,501 gas x observed burn price | 0.0042154184810501 |
| Deploy action + receipt gas, self-deploy upfront | same gas x minimum purchase price; subtotal, excludes other overhead | 0.042154184810501 |
| Initialize call, 100 TGas | upfront liquidity, unused/price-difference gas refundable | 0.1 |
| Operator call, 50 TGas | upfront liquidity per call, before attached deposits | 0.05 |
| Monitor call, 50 TGas | upfront liquidity per call, before attached deposits | 0.05 |
| Payout/refund, 250 TGas | upfront liquidity in caller account, before attached deposits | 0.25 |

Self-deploy subtotal is computed from the observed receipt/base/per-byte fees:

`receipt.send_sir + receipt.execution + deploy.send_sir + deploy.execution + wasm_bytes * (deploy_per_byte.send_sir + deploy_per_byte.execution)`.

This is a protocol action-cost subtotal, not a measurement of final transaction gas burnt. If a registrar/cross-account deployment route is chosen instead, the observed non-self action subtotal is 65,953,488,832,313 gas and must be recomputed for that route. Actual initialized storage, signed transaction overhead, runtime gas, FT storage minimum and final Wasm changes remain separate inputs. Storage allowance may reduce the actual stake; the reserve intentionally does not rely on it.

Provisional starting balances, rounded upward to cover this candidate's reserves and upfront liquidity:

| Account | NEAR allocation | Meaning |
|---|---:|---|
| Contract | **6.50** | Candidate code stake, reserved state/growth and deployment/initialization gas liquidity |
| Operator | **0.50** | Separate operational calls; no trading/customer funds |
| Monitor | **0.25** | Small termination-monitor gas pool; no trading/customer funds |
| Shared funder, retained Keyfolio fee envelope | **0.05** | Allowance for serialized activation transfers, creation refund charges and overhead; exact fees must be refreshed |
| Keyfolio native planning envelope | **7.30** | 7.25 transferred + 0.05 retained fee envelope; not an instruction to fund |

This excludes all ShowStake allocation, the trader/follower balances, subscription FT purchase amounts, subscription-token storage registration, Confidential Intents deposits, swap minimums/fees and any hosting costs. The final reviewed artifact and measured state can change this envelope. Do not deploy the mock FT to mainnet or assume the testnet mock asset is USDC.

## Review blockers before final Wasm

The current source is not cleared for financial deployment. Coordinator review found:

1. `nft_resolve_transfer` currently treats a receiver response of `false` as rejection; NEP-171 requires `true` to return the token. Malformed results are also not treated as rejection by the current expression. A deployed receiver/actual callback test is needed.
2. NFT transfer entrypoints call `internal_transfer_unguarded` without the required one-yocto deposit checks, and transfer-call pending state needs overlap/reentrancy review.
3. Per-trader `Vector` creation reuses the fixed `b"tk"` prefix, risking cross-trader index collision. Distinct traders need independently tested storage namespaces.
4. Renewal adds tranche storage without a corresponding native storage charge; purchase ID/size and state growth need bounds. Funding reserves alone cannot fix this.
5. Withdrawal/refund/callback traversal is unbounded; N09/N10/N12 financial/concurrency and bounded-processing acceptance remains open.

These findings require verified regressions and fixes followed by a new Wasm hash and same-artifact gas/storage measurement. Do not relabel the 26 passing host tests as an independent mainnet approval.

## Shared-funder transaction discipline

No funding transaction is sent in this preparation. A local per-project lock alone does not coordinate another project or wallet. Before later use of the shared funder:

1. Agree an exclusive funding window or a shared single-writer queue with the other agent; if unavailable, remain blocked.
2. Only the funder wallet signs. No project copies its private key or accesses another project's credentials.
3. Send one approved funding transfer at a time and wait for final outcome including receipts before starting the next.
4. Read the actual signing access-key nonce and fresh block reference immediately before each signature. Do not preallocate nonce batches or blindly retry ambiguous transfers.
5. Reconcile timeout/unknown results by original transaction hash before any re-sign/rebroadcast decision.
6. After funding, deployment and normal operator/monitor transactions use Keyfolio's own accounts and independent keys. The shared funder is not the app/admin runtime signer.

## Official references

- [Current protocol configuration](https://docs.near.org/api/rpc/protocol)
- [Gas price RPC](https://docs.near.org/api/rpc/gas)
- [Gas purchase, burn and account-creation pricing](https://docs.near.org/protocol/transactions/gas)
- [Storage stake](https://docs.near.org/protocol/storage/storage-staking)
- [NEP-171 transfer and receiver semantics](https://github.com/near/NEPs/blob/master/neps/nep-0171.md)

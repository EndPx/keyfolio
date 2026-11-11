# KF-05 native storage accounting — 2026-11-12

**Codex ACCEPTED PASS_LOCAL for the bounded native registration/mint/renewal/withdrawal fixes and measurements.** Scope is an isolated new deployment; storage record layout changed and has no migration for already initialized accounts. Full KF-05 security acceptance, production FT selection, final Wasm, paid launch and mainnet funding/deployment approval remain open. Worker performed no public-network transaction, signing, funding, key access, provider outreach, commit or push. Coordinator publication of this local milestone is separate from deployment approval.

## Changes and ABI

Each registered native storage account now contains a fixed-size available credit, pending payout and payout nonce. First registration charges its actual persistent registry growth against the attached NEAR; too small a deposit panics, so NEAR refunds and writes roll back. Subsequent deposits credit their attached amount with checked arithmetic, including the outstanding pending liability. Mint and renewal measure actual persistent growth and deduct it from available credit after performing their writes. An insufficient balance aborts the entire receipt: the FT resolver returns the entire FT amount, and the NFT/tranche/index changes roll back. Unused prepaid credit can be withdrawn while owning or after transferring a token; consumed storage charges are not refunded.

Native withdrawal requires exactly one yocto. It reserves credit in the already-funded fixed-size record before the native transfer, permits one pending payout per account, and invokes a private callback with account and nonce. A failed native transfer restores credit; success clears the pending amount. A duplicate or stale callback fails without a second credit; no recipient argument is supplied by the caller. Callback storage is preallocated during registration and neither reservation nor settlement grows the account record. The one-yocto authorization deposit is not treated as customer storage credit.

`storage_minimum_balance` now serializes as a canonical JSON **string** through `U128`; previous raw JSON numeric consumers must update. Its value is now a larger planning estimate (9,416 bytes in this local test), not an exact charge, promise of sufficiency for every future state or registration quote. `storage_deposit` returns remaining available credit after first-registration charge; `storage_balance_of` reports available credit excluding pending payout. Withdrawal returns remaining available credit immediately; settlement occurs asynchronously. `purchase_id` now accepts 1–128 ASCII letters, digits, `_`, `-`, `.`; invalid IDs refund before mutation. Expiry, sequence, costs and native balances use checked arithmetic. This input restriction and state layout are explicit contract compatibility changes.

## Verified tests

- Windows, `contracts/access`: `cargo test --locked --lib` **40/40 PASS_LOCAL**; `cargo build --locked --release --target wasm32-unknown-unknown` succeeded. Host tests cover registry and exact mint/renew growth charges, available credit, callback failure restore and duplicate rejection, one-yocto validation, pending payout invariant, and purchase ID rejection.
- WSL Ubuntu-24.04, separate `CARGO_TARGET_DIR=/home/albary/.cache/keyfolio-kf05-target`, PATH `/home/albary/.cargo/bin:/usr/local/bin:/usr/bin:/bin`: `bash ../../.deploy-local/keyfolio-review-sandbox.sh` from `contracts/access` ran legacy Sandbox **3/3**, mock-FT integration **1/1**, and exact-artifact sizing **1/1**, all PASS_LOCAL. FT fixture is local `contracts/mock-ft/target/wasm32-unknown-unknown/release/mock_ft.wasm`, built separately, not a production token.
- Real mock FT `ft_transfer_call` resolver returns spent `0` with unchanged FT balances, unchanged contract storage and no NFT when a registered buyer has zero available storage credit. Failed renewal similarly returns spent `0` with unchanged FT balances/storage and exactly one original tranche. These failures exercise actual receipt rollback after tentative writes.
- Sizing uses distinct local-only 64-character owner, monitor, trader, buyer and FT accounts and a maximum 128-character purchase ID. It verifies a 1-yocto first registration fails without storage growth, decodes the minimum with an independent JSON string decoder, and computes charges independently from storage byte deltas and 10^19 yocto/byte. The direct FT receiver measurements exclude the FT transfer and resolver; those are exercised separately above.
- The local Sandbox test deliberately patches only the local contract's account balance down to 6 NEAR to force native transfer failure while preserving code/state; the failure receipt and callback restore the exact 934600000000000000000000 yocto credit. After restoring the local test balance, the buyer withdraws half while owning, transfers the NFT, and withdraws the remaining credit successfully. Host tests separately verify pending + available conservation and duplicate callback rejection; transient pending state was not independently observed by an on-chain view. This artificial fault injection is not evidence of public-network solvency.

The independent arithmetic for the measured example is: deposit 1000000000000000000000000 = registration stake 3260000000000000000000 + mint stake 53980000000000000000000 + renewal stake 8160000000000000000000 + available credit 934600000000000000000000. During a withdrawal, credit moves from available to pending; successful transfer removes the pending liability, failure moves it back. Operator-funded code/initial/plan storage is separate from this customer equation. NEAR gas, authorization yocto and unrelated balances are excluded from that equation.

## Artifact and same-artifact measurements

Old candidate: 583370 bytes, SHA-256 `515190ff3c26cdb95fe74928db3a178ba27abf120187acb75434b751aa03f832`. New Windows release: **587925 bytes**, SHA-256 `b4d1db8885a09a0a16c17123ce60728c3cb567a0a0700cc0064fb04c1955ce8e`, checked before and after the local Sandbox run. Previous committed `src/lib.rs` Git-blob SHA-256 `89d76a4589305cdb4bf079a598779227ad6fdff34dfb4902ad77a324e465feb1`; current Windows source SHA-256 `c41521d86d5eb8a9868f2845b57145f86db497eed23444e2f14e5abf0f9fd5be` (Git LF normalization means byte hashes depend on checkout line endings). `Cargo.toml` SHA-256 `e61a4ef070a54b8ba6664d766a36166fcf03426c83e5fbee921cb51a1d1859bc`; `Cargo.lock` SHA-256 `0b5b521e1dfc30f48db95b097a1fb3eac35bdc168fe49be6b065220371ea2e60`. Linux test target is separate; tests load the Windows-built Wasm by path.

Sandbox near-sandbox 2.14.0, block header latest protocol version **88**. Account storage usage in bytes:

| Checkpoint | Bytes | Delta |
|---|---:|---:|
| before deploy | 182 | — |
| after deploy | 588107 | 587925 |
| after new | 588740 | 633 |
| after set_plan | 588992 | 252 |
| after deposit | 589318 | 326 |
| after first mint | 594716 | 5398 |
| after renewal | 595532 | 816 |

Each gas total is transaction plus all receipt `gas_burnt`, checked against near-workspaces total; amounts below are gas units, not tokens. Calls prepaid 100 TGas each; deploy had no function-call prepaid gas. Only storage_deposit attached 1 NEAR; other measured calls attached zero. Native withdrawal test used 250 TGas and one yocto, separately from the sizing actions.

| Action | Transaction | Receipts | Total burnt |
|---|---:|---:|---:|
| deploy | 4298357687075 | 38256873351200 | 42555231038275 |
| new | 308589416358 | 3238938992660 | 3547528409018 |
| set_plan | 314353750380 | 2088816264526 | 2403170014906 |
| storage_deposit | 309680746310 | 2325180894815 | 2634861641125 |
| purchase receiver | 326846883710 | 4885419979337 | 5212266863047 |
| renew receiver | 328038976585 | 3444950145712 | 3772989122297 |

At the captured mainnet storage rate, the observed total after plan is 5.88992 NEAR and after this long-ID purchase and renewal 5.95532 NEAR; these include deploy bytes and account baseline. At captured gas price 10^8 yocto/gas the deploy burn equivalent is 0.0042555231038275 NEAR; at the minimum purchase price 10^9 its upfront gas equivalent is 0.042555231038275 NEAR. The 100 TGas call budget implies 0.1 NEAR upfront at that rate, not 0.1 NEAR spent. These figures do not establish a final funding budget; operator reserves, transaction overhead, gas refunds, account creation charge, FT storage and current network state need separate review.

## Remaining risks

- NFT transfer and transfer-call can add owner/index and pending-lock storage; this milestone charges registration, mint and renewal only. Establish who funds all transfer-related and callback-related growth, including longest account IDs, before financial release.
- Bounded FT withdrawal/refund/callback processing and adversarial liability/concurrency tests N09/N10/N12 remain unfinished. If a native callback itself is never executed, the fixed pending reservation remains locked; the present failure test covers a failed native transfer with an executed callback, not callback gas exhaustion or recovery from a lost callback.
- A deployed NFT receiver callback fixture remains untested. Sandbox is local evidence and does not establish testnet/mainnet behavior, final production readiness, or policy acceptance.

## Independent coordinator verification

Codex inspected the diff and independently re-ran 40/40 host tests and all 5 local Sandbox tests (3 legacy, 1 actual FT integration, 1 sizing/native recovery) against the exact candidate hash before and after. The measured storage and native-credit values match the worker report, including maximum-length purchase IDs and the independent deposit equation. The earlier storage assertions in `sandbox.rs` were replaced by the stronger actual-delta assertions in `sandbox_sizing.rs`, rather than removed from acceptance.

The coordinator run observed deployment receipt gas **38,480,055,913,700**, transaction gas **4,298,357,687,075**, total **42,778,413,600,775**. The worker run above observed **42,555,231,038,275**. Their difference is **223,182,562,500** gas in receipts; the binary and storage measurements are identical. These are separate observed receipt totals and must not be represented as one invariant fee. At the captured burn rate, the coordinator deployment total corresponds to **0.0042778413600775 NEAR**; the purchase-price equivalent is **0.042778413600775 NEAR**. Other recorded action gas values matched. This is another reason to retain a liquidity/fee margin and refresh rates before any authorized funding.

Machine-readable current measurements: [native-storage-sizing-2026-11-12.json](native-storage-sizing-2026-11-12.json). The native 1 NEAR customer equation and all gas sums were checked with exact integers. Mainnet budget remains provisional until transfer/callback growth and bounded financial processing are reviewed and measured.

# KF-05 local safety correction and same-artifact sizing — 2026-11-12

Classification: **IMPLEMENTED / PASS_LOCAL** for the bounded fixes and local sizing only. Full KF-05, independent security review, production FT selection and mainnet readiness remain open. No public-chain transaction, key access, funding or deployment occurred. No commits or pushes were made.

The callback interprets `true` as return and `false` as retain; failed or malformed results return the token. Both transfer entrypoints require exactly one yocto. While a transfer is pending, both transfer entrypoints, renewal and refund are blocked; callback tests check lock and epochs. Per-trader token vectors use distinct namespaces. This changes storage layout; a previously initialized deployment needs a reviewed migration, which is not supplied.

## Candidate and tests

Windows `cargo build --locked --release --target wasm32-unknown-unknown` in `contracts/access` produced 583,370 bytes, SHA-256 `515190ff3c26cdb95fe74928db3a178ba27abf120187acb75434b751aa03f832`. This hash was checked before and after the Sandbox runs; the Linux harness read this exact Windows artifact. Previous candidate: 582,307 bytes, SHA-256 `80d1340207c7e14c0162c5d63d4374e58c58c0c67db0890c18c1e4f825adf9cf`. Source hashes: `Cargo.toml` e61a4ef070a54b8ba6664d766a36166fcf03426c83e5fbee921cb51a1d1859bc; `Cargo.lock` 0b5b521e1dfc30f48db95b097a1fb3eac35bdc168fe49be6b065220371ea2e60; `src/lib.rs` 00f16c92002f9770470e5c2d453135a54cfe879f72b4d1361d6feb82337ca55d; `src/vesting.rs` be992e78ed772b54b5f9e5238375bf24beb002d16ed2024b93830294edebe77e. Test-only edits did not change contract source or Wasm.

Windows `cargo test --locked --lib`: **37/37 PASS_LOCAL**. Mocked promise results cover true, false, malformed and failed callbacks; deposits 0 and 2 reject, one yocto succeeds, and transfer epoch behavior is checked. Two traders and separate buyers have separate indices and independently calculated midpoint earnings 50 and 101. New pending-lock test checks unused FT returned without a tranche, refund rejection and lock preservation. A separate storage test checks the full credit equation across mint, withdrawal, transfer and final withdrawal.

Ubuntu-24.04 WSL, explicit PATH `/home/albary/.cargo/bin:/usr/local/bin:/usr/bin:/bin`, separate `CARGO_TARGET_DIR=/home/albary/.cache/keyfolio-kf05-target`: `cargo test --locked --test sandbox_sizing -- --nocapture` **1/1 PASS_LOCAL**; `cargo test --locked --test sandbox_ft -- --nocapture` **1/1 PASS_LOCAL** using `FT_WASM` pointing to `contracts/mock-ft/target/wasm32-unknown-unknown/release/mock_ft.wasm`, built with `cargo build --locked --release --target wasm32-unknown-unknown` in `contracts/mock-ft` (SHA-256 79da31a6eca52f1e2c0d1d25eb209e49099485d566426cb11f72fc0c4ef887ad). `near-workspaces 0.24.0`, `near-sandbox 0.4.0` default runtime 2.14.0; local block header protocol version 88. An initial FT run failed solely because the mock FT Wasm was absent, then succeeded after the local build. The real mock-FT suite tests a purchase, withdrawal and refund through local cross-contract receipts. Callback results true/false/malformed/failure were tested at host callback level, not against a deployed receiver fixture.

## Same-artifact measurements

The local sizing harness uses distinct deterministic disposable local-only 64-character implicit owner, monitor, trader, buyer and FT signer accounts; the contract itself uses a Sandbox development subaccount. No real account keys or data are used. It invokes `ft_on_transfer` from the configured local FT account directly for purchase and renewal, so those gas values exclude the originating FT transfer and resolver; the separate FT integration test covers that real receipt path without sizing it. Fixed example: price 101 atomic, term 1,000,000 ms, purchase ID `sizing-1`. Storage deposit is 1 NEAR. State deltas depend on inputs; these are not upper bounds.

| Point | Contract account storage bytes | Delta |
|---|---:|---:|
| Before deploy | 182 | — |
| After deploy | 583,552 | 583,370 |
| After initialization | 584,185 | 633 |
| After set_plan | 584,437 | 252 |
| After storage_deposit | 584,739 | 302 |
| After purchase | 588,457 | 3,718 |
| After renewal | 589,033 | 576 |

Every gas total is the transaction outcome plus **all** receipt outcome gas burnt; harness checks the sum against near-workspaces `total_gas_burnt`. Tokens burnt are not used as gas. Calls each prepaid 100 TGas; deploy is an action transaction with no function-call prepaid gas. Attached deposits are zero except storage_deposit 1 NEAR.

| Action | Transaction gas | Receipts gas | Total gas burnt | Prepaid call gas |
|---|---:|---:|---:|---:|
| deploy | 4,267,324,476,630 | 37,962,743,591,280 | 42,230,068,067,910 | N/A |
| new | 308,589,416,358 | 3,234,032,378,587 | 3,542,621,794,945 | 100 TGas |
| set_plan | 314,353,750,380 | 2,083,910,473,209 | 2,398,264,223,589 | 100 TGas |
| storage_deposit | 309,680,746,310 | 2,163,568,805,380 | 2,473,249,551,690 | 100 TGas |
| direct FT receiver purchase | 321,124,837,910 | 4,568,311,395,696 | 4,889,436,233,606 | 100 TGas |
| direct FT receiver renewal | 322,316,930,785 | 2,916,688,909,456 | 3,239,005,840,241 | 100 TGas |

## Native balance estimate and limits

Using the previously captured mainnet snapshot, not a fresh network query: storage 10^19 yocto/byte, gas burn price 10^8 yocto/gas, minimum purchase price 10^9 yocto/gas and account-creation charge 0.007 NEAR. Measured storage after plan is 5.84437 NEAR at that rate; after purchase and renewal it is 5.89033 NEAR. These totals include code and the 182-byte account baseline; do not add code or baseline a second time. At the captured burn price, local deploy gas corresponds to 0.004223006806791 NEAR; its gas purchase-price equivalent is 0.04223006806791 NEAR. For each 100 TGas call, minimum upfront gas liquidity is 0.1 NEAR; unused or price-difference amounts may be refunded, and this is not the burn fee. Account creation refund charge is a separate applicable protocol charge, not a second transfer on top of gas accounting.

The earlier provisional allocation of 6.50 contract + 0.50 operator + 0.25 monitor + 0.05 retained funder envelope = **7.30 NEAR** remains a preliminary planning assumption, not a funding request. Contract allocation includes measured initial stake, an assumed 0.25 NEAR growth reserve and operational liquidity; it is not an upper bound on growth or liabilities. The extra 1 NEAR storage deposit in this experiment is customer prepaid credit/consumed charge and is not counted as operator funding. Funding route, transaction overhead, FT registration, actual fees and reserves must be reviewed and refreshed. No mock FT mainnet deployment; production FT is unresolved.

## Storage claim correction and remaining findings

The prior report's **Critical claim that transfer releases already-consumed mint backing was not established and is withdrawn**. At purchase `handle_purchase` subtracts one minimum from the buyer's credit. In the regression, starting deposit D=3 NEAR and mint cost M, the credit after mint is D-M; while owning the token the buyer can withdraw D-2M, leaving M credit; after transfer they can withdraw that remaining M, so total withdrawn D-M and the consumed M remains. This is credit arithmetic only; it does not prove global native solvency or that M covers actual persistent growth.

- High — `src/lib.rs:491` storage withdrawal subtracts owned slots **again** from already-debited credit, retaining user credit while they own an NFT; transfers change whose credit is restricted. Detached native transfer at line 512 has no failure callback restoring credit. The actual user-rights and solvency impact needs independent end-to-end tests and redesign.
- High — `src/lib.rs:402` renewal adds uncharged records; the local example grew by 576 bytes. Purchase creates persistent indexes, IDs and tranche records; bounds and actual cost coverage must be assessed for arbitrary inputs. No global storage solvency claim follows from one example.
- High — `src/lib.rs:561`, `:628`, `:715`, `:814` traverse potentially unbounded token/tranche/allocation collections. Gas exhaustion can prevent withdrawal, refund or callback recovery and may leave locks; N09/N10/N12 remain open.
- High — independent security review, deployed receiver callback integration, randomized native/FT liability and concurrency tests, production FT and paid-launch policy gates remain unresolved. Sandbox evidence is local only.

## Coordinator review and additional measurement

Codex reviewed the transfer/pending-lock/per-trader namespace diff against the required semantics and independently ran Windows host tests: **37/37 PASS**. Codex then ran the exact candidate in the existing local WSL Sandbox harness: legacy Sandbox **3/3 PASS**, real mock-FT integration **1/1 PASS**, and sizing **1/1 PASS**. The binary hash remained `515190ff3c26cdb95fe74928db3a178ba27abf120187acb75434b751aa03f832`.

Codex added a read of `storage_minimum_balance` to the sizing test. It currently returns a native JSON number (`u128`), rather than a canonical atomic string; the first instrumented test used String deserialization and correctly failed. Changing only the test decoder to `u128` allowed the exact observation: **32,720,000,000,000,000,000,000 yoctoNEAR**, equivalent to **3,272 bytes** at the captured storage rate. The fixture's first mint grows state by **3,718 bytes**, so the charge is **446 bytes / 0.00446 NEAR below measured growth**. Renewal then adds **576 bytes / 0.00576 NEAR** without charging native credit. These are concrete measured undercharge examples, not maximum growth bounds. Increasing an operational reserve does not fix unbounded native subsidy.

The bounded transfer corrections, regression tests and same-artifact sizing are **Codex ACCEPTED PASS_LOCAL**. Full financial-contract/mainnet acceptance is **not** granted: actual state-growth charging, exact wire amount serialization, native refund recovery, input bounds and bounded payout/refund/callback processing still need remediation. The withdrawn critical backing claim is not reinstated. Machine-readable measurements: [mainnet-safety-sizing-2026-11-12.json](mainnet-safety-sizing-2026-11-12.json).

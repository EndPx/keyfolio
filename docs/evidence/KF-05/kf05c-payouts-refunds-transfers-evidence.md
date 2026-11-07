# KF-05c evidence — termination, payouts, refunds, transfer epochs (PASS_LOCAL)

Task/Test ID: KF-05c (partial): service termination with contract cutoff, trader withdrawal and owner refund via asynchronous reserved payouts with once-only callbacks, NFT transfer with access-epoch transitions and transfer_call rollback, refund transfer lock. NOT KF-05 acceptance: sandbox tests and deployment are still TODO (KF-05d).

Commit + branch: see git log; branch main.
Environment: local Windows host; cargo 1.99.0; near-sdk 5.30.1 + near-contract-standards 5.30.1; `cargo test --locked`.
Observed result: 26/26 tests pass (6 vesting + 12 purchase/renewal + 8 payout/transfer); wasm32-unknown-unknown check clean; zero warnings.
Classification: PASS_LOCAL.

## What the tests prove (independent expected values)

- Termination (KF-D010): only monitor/owner; cutoff = the accepting transaction's block time (not caller-supplied); earnings freeze at the cutoff (claimable 50 stays 50 as time advances past term end); unvested remainder (51 of 101) becomes refundable.
- Withdrawal (N06/N08): vested-but-unwithdrawn is reserved into `withdrawn` BEFORE the external FT call; the private callback settles exactly once — success finalizes, failure restores every tranche allocation once; a duplicate callback for a settled action panics (no double-pay, no double-restore). Promises are returned from the methods (a dropped-promise bug was caught by the compiler lint and fixed).
- Refund (N07/N08/N12): only the current NFT owner, only after termination; the unvested remainder is reserved into `refunded` and the token is TRANSFER-LOCKED while the payout is pending; lock clears on both success and failure; failure restores the reservation once and re-enables claims.
- Transfers (D06/E03/E04): direct transfer bumps access_epoch (1 -> 2) and passes ownership; non-owner transfers panic; a rejected nft_transfer_call rolls back (validated in isolation) and the return-to-sender bumps the epoch AGAIN (2 -> 3), so A->C->A never revives old credentials; the pending mark clears on resolve (E06 shape; on-chain pending denial is exercised by the entitlement worker in KF-07).
- Refund-then-transfer sequencing: after a settled refund the owner may transfer the expired receipt NFT.

## Honest limits

- Host-unit scope: the real FT promise/callback execution path (payout_callback reading promise results, actual USDC transfer) is verified in KF-05d NEAR sandbox tests (N08/N10) under WSL; host tests exercise the settlement core directly.
- STORAGE_BUFFER_BYTES verification, N01-N12 matrix, and deployment: NOT_RUN (KF-05d).
- No Codex ACCEPTED verdict for KF-05; nothing deployed.

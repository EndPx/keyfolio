'use client';

/**
 * TESTNET checkout (KF-08b): real contract preflight + real wallet signing
 * through a shared action builder. Config comes from the server page. Every
 * on-chain prerequisite is shown as an explicit gate; purchase only enables
 * when all gates pass AND the preflight is fresh (<=30s). A wallet success is
 * NOT a license — the flow only shows `confirmed` after the contract receipt
 * + owner binding is verified. No simulation, no fixture numbers, no
 * hardcoded decimals fallback.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../../wallet/WalletContext';
import { createTestnetClient, formatAtomic, formatYoctoNear, type TestnetClient } from '../../../testnet';
import { canPurchase, isPreflightStale, runCheckoutPreflight, type PreflightReady } from '../../../preflight';
import { buildPurchaseActions, purchaseMessage } from '../../../nearActions';
import {
  applyVerification,
  applyWalletError,
  applyWalletOutcome,
  beginPurchase,
  canOfferPurchase,
  classifyWalletResult,
  deriveTokenId,
  initialPurchaseState,
  localStorageAdapter,
  persistPurchaseRecord,
  purchaseStorageKey,
  recordFromState,
  resolveOrCreatePayload,
  restorePurchase,
  stateFromRecord,
  type PurchaseState,
} from '../../../purchaseFlow';

function formatTerm(termMs: number): string {
  const day = 86_400_000;
  if (termMs % day === 0) return `${termMs / day} days`;
  if (termMs >= day) {
    const days = Math.floor(termMs / day);
    const hours = Math.round((termMs % day) / 3_600_000);
    return `${days}d ${hours}h`;
  }
  return `${(termMs / 1000).toLocaleString('en-US')} seconds`;
}

export function CheckoutTestnet({
  rpcUrl,
  accessContract,
  traderId,
}: {
  rpcUrl: string;
  accessContract: string;
  traderId: string;
}) {
  const client: TestnetClient = useMemo(
    () => createTestnetClient({ rpcUrl, accessContract }),
    [rpcUrl, accessContract],
  );
  const { accountId, connecting, initError, signIn, selector } = useWallet();

  const [preflight, setPreflight] = useState<
    | { phase: 'loading' }
    | { phase: 'error'; fetchedAtMs: number; message: string }
    | PreflightReady
  >({ phase: 'loading' });
  const [stale, setStale] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseState>(initialPurchaseState);
  // Tracks which accountId the restored purchase corresponds to. Until the
  // async wallet account resolves AND the restore effect runs, `restoreComplete`
  // is false and the buy action stays disabled (no brief enable before a
  // pending/failed record is loaded).
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  // Restore the persisted purchase whenever the wallet account or binding
  // changes (the seam for reload/redirect recovery after async account resolve).
  useEffect(() => {
    const result = accountId
      ? restorePurchase(localStorageAdapter, { network: 'testnet', accessContract, traderId, buyer: accountId })
      : initialPurchaseState();
    setPurchase(result);
    setRestoredFor(accountId);
  }, [accountId, accessContract, traderId]);

  const restoreComplete = accountId === null || restoredFor === accountId;

  const load = useCallback(async () => {
    setPreflight({ phase: 'loading' });
    try {
      const result = await runCheckoutPreflight({ rpcUrl, accessContract }, traderId, accountId ?? null);
      setPreflight(result);
    } catch (err) {
      setPreflight({ phase: 'error', fetchedAtMs: Date.now(), message: String((err as Error).message ?? err).slice(0, 240) });
    }
  }, [rpcUrl, accessContract, traderId, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-evaluate freshness on an interval so stale gates disable actions.
  useEffect(() => {
    if (preflight.phase !== 'ready') return;
    setStale(isPreflightStale(preflight));
    const timer = setInterval(() => setStale(isPreflightStale(preflight)), 5000);
    return () => clearInterval(timer);
  }, [preflight]);

  const persist = useCallback((state: PurchaseState) => {
    if (!state.payload) return;
    const rec = recordFromState(state, Date.now());
    if (rec) {
      persistPurchaseRecord(
        localStorageAdapter,
        purchaseStorageKey(state.payload.network, state.payload.accessContract, state.payload.traderId, state.payload.buyer),
        rec,
      );
    }
  }, []);

  const verify = useCallback(
    async (state: PurchaseState): Promise<PurchaseState> => {
      if (!state.payload) return state;
      const p = state.payload;
      try {
        const hasPurchase = await client.viewHasPurchase(p.traderId, p.buyer, p.purchaseId);
        let owner: string | null = null;
        if (hasPurchase) {
          const license = await client.viewLicense(deriveTokenId(p));
          owner = license?.owner_id ?? null;
        }
        return applyVerification(state, hasPurchase, owner);
      } catch {
        // Verification unreadable: keep pending, do NOT mark failed.
        return { ...state, phase: 'pending-unknown', reason: 'Verification unreadable — recovery pending.' };
      }
    },
    [client],
  );

  async function buy() {
    if (preflight.phase !== 'ready') return;
    if (!accountId || !selector || !restoreComplete) return;
    if (stale || !canPurchase(preflight, Date.now())) {
      setStale(true);
      await load();
      return;
    }
    if (!canOfferPurchase(purchase)) return; // unresolved or confirmed: no new intent

    const g = preflight;
    const plan = g.plan;
    const trader = g.trader;
    if (!plan || !trader) return;
    if (g.ftDecimals === null) return; // metadata gate already blocks; no lifecycle transition

    const resolution = resolveOrCreatePayload(
      {
        network: 'testnet',
        accessContract,
        ftContract: g.info.ft_id,
        traderId,
        planVersion: trader.current_plan_version,
        priceAtomic: plan.price,
        buyer: accountId,
      },
      localStorageAdapter,
    );
    if (resolution.kind === 'blocked') {
      setPurchase({ ...stateFromRecord(resolution.record), reason: resolution.reason });
      return;
    }
    const payload = resolution.payload;

    let state = beginPurchase(purchase, payload);
    setPurchase(state);
    persist(state);
    try {
      const wallet = await selector.wallet();
      const msg = purchaseMessage({ traderId, planVersion: trader.current_plan_version, purchaseId: payload.purchaseId });
      const result = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: g.info.ft_id,
        actions: buildPurchaseActions({ accessContract, amountAtomic: plan.price, msg }),
      });
      state = applyWalletOutcome(state, classifyWalletResult(result));
      setPurchase(state);
      persist(state);
      if (state.phase === 'submitted' || state.phase === 'pending-unknown') {
        const verified = await verify(state);
        setPurchase(verified);
        persist(verified);
      }
    } catch (err) {
      state = applyWalletError(state, err);
      setPurchase(state);
      persist(state);
    }
  }

  async function recover() {
    if (!purchase.payload) return;
    const verified = await verify(purchase);
    setPurchase(verified);
    persist(verified);
  }

  if (preflight.phase === 'loading') {
    return <p className="meta-line" role="status">Loading contract state from NEAR testnet...</p>;
  }
  if (preflight.phase === 'error') {
    return (
      <div className="panel note-error" role="status">
        <p className="terms-text">Contract query failed: {preflight.message}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const g = preflight;
  const allOk = canPurchase(g, Date.now());
  const decimals = g.ftDecimals;
  const symbol = g.ftSymbol ?? 'FT';
  const priceDisplay =
    decimals !== null && g.plan ? `${formatAtomic(g.plan.price, decimals)} ${symbol}` : '(price unavailable — decimals unknown)';
  const storageDisplay =
    g.storageMinimum !== null
      ? `${formatYoctoNear(g.storageMinimum)} NEAR (native, separate from price)`
      : 'storage minimum unavailable';
  const blockLine = g.block
    ? `Block #${g.block.height} · fetched ${new Date(g.fetchedAtMs).toISOString().replace('T', ' ').slice(0, 19)} UTC`
    : 'Block context unavailable';

  return (
    <div>
      <p className="meta-line">
        Single demo trader: <strong>{traderId}</strong> · access contract {accessContract} · FT {g.info.ft_id}
      </p>
      <ul className="gates" aria-label="Purchase prerequisites">
        {g.gates.map((x) => (
          <li key={x.id} className={x.ok ? 'gate ok' : 'gate blocked'}>
            <span aria-hidden="true">{x.ok ? '✓' : '✗'}</span> {x.label}
            {!x.ok && x.detail ? <span className="meta-line"> — {x.detail}</span> : null}
          </li>
        ))}
      </ul>
      <p className="meta-line">
        Live plan from contract: {g.plan ? `${g.plan.price} atomic · ${formatTerm(g.plan.term_ms)} term` : 'no plan'}
        {decimals !== null ? ` · ${decimals} decimals (from ft_metadata)` : ' · decimals unavailable — ft_metadata did not resolve'}
      </p>
      <p className="meta-line">Storage: {storageDisplay}</p>
      <p className="meta-line">{blockLine} · preflight {allOk ? 'fresh' : stale ? 'STALE (>30s)' : 'blocked'}</p>
      {g.warnings.length > 0 && (
        <p className="meta-line" role="status">Warnings: {g.warnings.join('; ')}</p>
      )}

      {purchase.phase === 'awaiting-wallet' && (
        <div className="state-chip chip-pending" role="status">Wallet prompt open — confirm or cancel in your wallet.</div>
      )}
      {purchase.phase === 'submitted' && (
        <div className="state-chip chip-pending" role="status">
          Submitted{purchase.txHash ? ` (${purchase.txHash})` : ''} — verifying license on chain…
        </div>
      )}
      {purchase.phase === 'pending-unknown' && (
        <div className="state-chip chip-pending" role="status">
          Recovery pending — do not resubmit.{' '}
          <button type="button" className="btn btn-secondary" onClick={() => void recover()}>Verify license now</button>
        </div>
      )}
      {purchase.phase === 'confirmed' && (
        <div className="state-chip chip-success" role="status">
          License confirmed for {purchase.payload?.buyer} (owner verified on chain).
        </div>
      )}
      {purchase.phase === 'failed' && (
        <div className="state-chip chip-failed" role="status">
          {purchase.rejectedByWallet ? 'Wallet declined or errored: ' : 'Purchase failed: '}
          {purchase.reason}
        </div>
      )}

      {accountId ? (
        !restoreComplete ? (
          <span className="btn btn-disabled" role="status">Restoring previous purchase intent…</span>
        ) : purchase.phase === 'confirmed' ? (
          <span className="btn btn-disabled" role="status">Already confirmed — this flow does not re-purchase the same license</span>
        ) : canOfferPurchase(purchase) ? (
          allOk ? (
            <button type="button" className="btn btn-primary" onClick={() => void buy()}>
              Buy access · {priceDisplay} / {formatTerm(g.plan?.term_ms ?? 0)}
            </button>
          ) : (
            <span className="btn btn-disabled" role="status">Complete the checks above to enable purchase</span>
          )
        ) : (
          <span className="btn btn-disabled" role="status">Resubmission blocked until the previous attempt is recovered</span>
        )
      ) : (
        <button type="button" className="btn btn-secondary" onClick={signIn}>Connect wallet</button>
      )}
      <p className="meta-line">
        Demo note: single-trader checkout (trader {traderId}) — multi-trader routing is a later milestone.
        A verified license grants read access for its active term only; a public owner read is not private account ownership.
      </p>
      {initError && <p className="meta-line" role="status">Wallet init error: {initError}</p>}
      {connecting && !initError && <p className="meta-line" role="status">Connecting wallet service...</p>}
    </div>
  );
}
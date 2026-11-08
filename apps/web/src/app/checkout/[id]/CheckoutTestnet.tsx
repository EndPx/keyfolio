'use client';

/**
 * TESTNET checkout (KF-08b.2): real contract queries + real wallet signing.
 * Prerequisites are checked on-chain and shown as explicit gates — the buy
 * action only enables when every one of them exists:
 *   1. contract_info + current plan published and active;
 *   2. seller sales enabled and service not terminated;
 *   3. the subscription FT (contract_info.ft_id) actually deployed;
 *   4. a signed-in wallet.
 * No simulation, no fixture numbers, no fake signatures in this mode.
 */

import { transactions } from 'near-api-js';
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../../../wallet/WalletContext';
import {
  ACCESS_CONTRACT,
  DEMO_TRADER,
  accountExists,
  viewContractInfo,
  viewCurrentPlan,
  viewLicense,
  viewTrader,
  type ContractInfo,
  type PlanJson,
} from '../../../testnet';

type Gate =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; info: ContractInfo; plan: PlanJson; ftDeployed: boolean };

function useTestnetCheckout() {
  const [gate, setGate] = useState<Gate>({ phase: 'loading' });

  const load = useCallback(async () => {
    setGate({ phase: 'loading' });
    try {
      const info = await viewContractInfo();
      const plan = await viewCurrentPlan(DEMO_TRADER);
      if (!plan || !plan.active) {
        setGate({ phase: 'ready', info, plan: { price: '0', term_ms: 0, active: false }, ftDeployed: false });
        return;
      }
      const ftDeployed = await accountExists(info.ft_id);
      setGate({ phase: 'ready', info, plan, ftDeployed });
    } catch (err) {
      setGate({ phase: 'error', message: String((err as Error).message ?? err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { gate, reload: load };
}

const GAS_FT_TRANSFER_CALL = '250000000000000'; // 250 Tgas for the full promise chain

export function CheckoutTestnet() {
  const { selector, accountId, connecting, signIn } = useWallet();
  const { gate, reload } = useTestnetCheckout();
  const [buying, setBuying] = useState(false);
  const [outcome, setOutcome] = useState<
    | { kind: 'pending' }
    | { kind: 'success'; txHash: string }
    | { kind: 'failed'; message: string }
    | null
  >(null);

  const traderState = useTraderState(gate.phase === 'ready');

  async function buy(info: ContractInfo, plan: PlanJson) {
    if (!accountId || !selector) return;
    setBuying(true);
    setOutcome({ kind: 'pending' });
    try {
      const wallet = await selector.wallet();
      const msg = JSON.stringify({
        action: 'purchase',
        trader_id: DEMO_TRADER,
        plan_version: 1,
        purchase_id: `web-${Date.now()}`,
      });
      const result = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: info.ft_id,
        actions: [
          // near-js Action class; cast bridges the selector's bundled copy.
          transactions.functionCall('ft_transfer_call', {
            receiver_id: ACCESS_CONTRACT,
            amount: plan.price,
            memo: 'keyfolio access purchase',
            msg,
          }, BigInt(GAS_FT_TRANSFER_CALL), BigInt(1)) as never,
        ],
      });
      const txHash =
        (result as { transaction_outcome?: { id?: string } }).transaction_outcome?.id ?? 'unknown';
      setOutcome({ kind: 'success', txHash });
      void reload;
      // License verification is explicit, not assumed from the tx outcome.
      const license = await viewLicense(`kf-${DEMO_TRADER}-${accountId}-web`);
      if (license && license.owner_id === accountId) {
        setOutcome({ kind: 'success', txHash });
      } else {
        setOutcome({
          kind: 'failed',
          message:
            'Transaction landed but the license view does not show it yet — check My Keys in a few seconds (finality delay).',
        });
      }
    } catch (err) {
      setOutcome({ kind: 'failed', message: String((err as Error).message ?? err).slice(0, 300) });
    } finally {
      setBuying(false);
    }
  }

  if (gate.phase === 'loading') {
    return <p className="meta-line" role="status">Loading contract state from NEAR testnet…</p>;
  }
  if (gate.phase === 'error') {
    return (
      <div className="panel note-error" role="status">
        <p className="terms-text">Contract query failed: {gate.message}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void reload()}>Retry</button>
      </div>
    );
  }

  const { info, plan, ftDeployed } = gate;
  const salesActive = traderState?.salesEnabled ?? false;
  const terminated = traderState?.terminated ?? false;

  const gates: { ok: boolean; label: string }[] = [
    { ok: !!plan && plan.active, label: 'Plan published and active' },
    { ok: salesActive && !terminated, label: 'Seller sales enabled (not terminated)' },
    { ok: ftDeployed, label: `Subscription FT deployed at ${info.ft_id}` },
    { ok: !!accountId, label: accountId ? `Wallet connected: ${accountId}` : 'Wallet connected' },
  ];
  const allOk = gates.every((g) => g.ok);

  return (
    <div>
      <ul className="gates" aria-label="Purchase prerequisites">
        {gates.map((g) => (
          <li key={g.label} className={g.ok ? 'gate ok' : 'gate blocked'}>
            <span aria-hidden="true">{g.ok ? '✓' : '✕'}</span> {g.label}
          </li>
        ))}
      </ul>
      {plan && plan.price !== '0' && (
        <p className="meta-line">
          Live plan from contract: {plan.price} atomic · {plan.term_ms.toLocaleString('en-US')} ms term
        </p>
      )}
      {outcome?.kind === 'pending' && (
        <div className="state-chip chip-pending" role="status">Purchase submitted — confirm in your wallet and wait for finality…</div>
      )}
      {outcome?.kind === 'success' && (
        <div className="state-chip chip-success" role="status">
          Purchase transaction completed: {outcome.txHash} — verify the license under My Keys.
        </div>
      )}
      {outcome?.kind === 'failed' && (
        <div className="state-chip chip-failed" role="status">Purchase failed: {outcome.message}</div>
      )}
      {!allOk && (
        <span className="btn btn-disabled" role="status">
          {ftDeployed ? 'Complete the checks above to enable purchase' : 'Purchase disabled — subscription FT not deployed yet (G02)'}
        </span>
      )}
      {allOk && (
        <button type="button" className="btn btn-primary" disabled={buying} onClick={() => void buy(info, plan)}>
          {buying ? 'Submitting…' : `Buy access · ${Number(plan.price) / 1e6} KF-TEST / 30 days`}
        </button>
      )}
      {!accountId && !connecting && (
        <button type="button" className="btn btn-secondary" onClick={signIn}>Connect wallet</button>
      )}
    </div>
  );
}

function useTraderState(enabled: boolean) {
  const [state, setState] = useState<{ salesEnabled: boolean; terminated: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    (async () => {
      try {
          const s = await viewTrader(DEMO_TRADER);
        if (!disposed) setState(s);
      } catch {
        if (!disposed) setState(null);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [enabled]);
  return state;
}


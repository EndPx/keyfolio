'use client';

/**
 * TESTNET checkout (KF-08b.2): real contract queries + real wallet signing.
 * Config comes from the server page via props (mode discipline - this
 * component is mounted only in TESTNET mode). Prerequisites are checked
 * on-chain and shown as explicit gates; the buy action only enables when
 * every one of them exists. No simulation, no fixture numbers.
 */

import { transactions } from 'near-api-js';
const GAS_FT_TRANSFER_CALL = '250000000000000';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../../wallet/WalletContext';
import {
  createTestnetClient,
  type TestnetClient,
  type TraderJson,
} from '../../../testnet';

/** Exact decimal display from the atomic string via bigint shift - no float. */
function formatAtomic(atomic: string, decimals: number): string {
  const digits = atomic;
  const d = BigInt(decimals);
  const value = BigInt(digits);
  const base = 10n ** d;
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}${frac ? `.${frac}` : ''}`;
}

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
  const [gate, setGate] = useState<
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | {
        phase: 'ready';
        info: { version: string; owner_id: string; monitor_id: string; ft_id: string };
        plan: { price: string; term_ms: number; active: boolean };
        trader: TraderJson | null;
        ftDeployed: boolean;
        ftDecimals: number | null;
      }
  >({ phase: 'loading' });
  const [buying, setBuying] = useState(false);
  const [outcome, setOutcome] = useState<
    | { kind: 'pending' }
    | { kind: 'success'; txHash: string }
    | { kind: 'failed'; message: string }
    | null
  >(null);

  const load = useCallback(async () => {
    setGate({ phase: 'loading' });
    try {
      const info = await client.viewContractInfo();
      const [plan, trader] = await Promise.all([
        client.viewCurrentPlan(traderId),
        client.viewTrader(traderId),
      ]);
      const active = !!plan && plan.active;
      const ftDeployed = active ? await client.accountExists(info.ft_id) : false;
      const ftMeta = ftDeployed ? await client.viewFtMetadata(info.ft_id) : null;
      setGate({
        phase: 'ready',
        info,
        plan: active ? plan : { price: '0', term_ms: 0, active: false },
        trader,
        ftDeployed,
        ftDecimals: ftMeta?.decimals ?? null,
      });
    } catch (err) {
      setGate({ phase: 'error', message: String((err as Error).message ?? err) });
    }
  }, [client, traderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy() {
    const g = gate.phase === 'ready' ? gate : null;
    if (!g || !accountId || !selector) return;
    const plan = g.plan;
    const trader = g.trader;
    if (!trader) return;
    setBuying(true);
    setOutcome({ kind: 'pending' });
    try {
      const wallet = await selector.wallet();
      const msg = JSON.stringify({
        action: 'purchase',
        trader_id: traderId,
        plan_version: trader.current_plan_version,
        purchase_id: `web-${Date.now()}`,
      });
      const result = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: g.info.ft_id,
        actions: [
          // Single deduped near-api-js instance (verified in pnpm-lock) makes
          // this cast type-only; see evidence note on finding 8.
          transactions.functionCall(
            'ft_transfer_call',
            {
              receiver_id: accessContract,
              amount: plan.price,
              memo: 'keyfolio access purchase',
              msg,
            },
            BigInt(GAS_FT_TRANSFER_CALL),
            BigInt(1),
          ) as never,
        ],
      });
      const txHash =
        (result as { transaction_outcome?: { id?: string } }).transaction_outcome?.id ?? 'unknown';
      // The tx hash is the outcome; license verification happens under My
      // Keys (finality lag must never be labeled a failure).
      setOutcome({ kind: 'success', txHash });
    } catch (err) {
      setOutcome({ kind: 'failed', message: String((err as Error).message ?? err).slice(0, 300) });
    } finally {
      setBuying(false);
    }
  }

  if (gate.phase === 'loading') {
    return <p className="meta-line" role="status">Loading contract state from NEAR testnet...</p>;
  }
  if (gate.phase === 'error') {
    return (
      <div className="panel note-error" role="status">
        <p className="terms-text">Contract query failed: {gate.message}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const g = gate;
  const salesActive = g.trader?.salesEnabled ?? false;
  const terminated = g.trader?.terminated ?? false;
  const planVersion = g.trader?.current_plan_version ?? null;

  const gates = [
    { ok: !!g.plan && g.plan.active, label: 'Plan published and active' },
    { ok: salesActive && !terminated, label: 'Seller sales enabled (not terminated)' },
    { ok: g.ftDeployed, label: `Subscription FT deployed at ${g.info.ft_id}` },
    { ok: !!accountId, label: accountId ? `Wallet connected: ${accountId}` : 'Wallet connected' },
  ];
  const allOk = gates.every((x) => x.ok);
  const decimals = g.ftDecimals ?? 6; // KF-TEST mock FT has 6; shown from ft_metadata when live
  const priceDisplay = `${formatAtomic(g.plan.price, decimals)} KF-TEST`;

  return (
    <div>
      <ul className="gates" aria-label="Purchase prerequisites">
        {gates.map((x) => (
          <li key={x.label} className={x.ok ? 'gate ok' : 'gate blocked'}>
            <span aria-hidden="true">{x.ok ? '✓' : '✗'}</span> {x.label}
          </li>
        ))}
        {planVersion !== null && (
          <li className="gate ok">
            <span aria-hidden="true">{'•'}</span> Plan version bound: v{planVersion}
          </li>
        )}
      </ul>
      <p className="meta-line">
        Live plan from contract: {g.plan.price} atomic · {formatTerm(g.plan.term_ms)} term
        {g.ftDecimals !== null ? ` · ${g.ftDecimals} decimals` : ' · decimals from FT metadata when deployed'}
      </p>
      {outcome?.kind === 'pending' && (
        <div className="state-chip chip-pending" role="status">
          Purchase submitted - confirm in your wallet and wait for finality...
        </div>
      )}
      {outcome?.kind === 'success' && (
        <div className="state-chip chip-success" role="status">
          Purchase transaction completed: {outcome.txHash} - verify the license under My Keys.
        </div>
      )}
      {outcome?.kind === 'failed' && (
        <div className="state-chip chip-failed" role="status">
          Purchase failed: {outcome.message}
        </div>
      )}
      {!allOk && (
        <span className="btn btn-disabled" role="status">
          {g.ftDeployed
            ? 'Complete the checks above to enable purchase'
            : 'Purchase disabled - subscription FT not deployed yet (G02)'}
        </span>
      )}
      {allOk && (
        <button type="button" className="btn btn-primary" disabled={buying} onClick={() => void buy()}>
          {buying ? 'Submitting...' : `Buy access · ${priceDisplay} / ${formatTerm(g.plan.term_ms)}`}
        </button>
      )}
      <p className="meta-line">
        Demo note: single-trader checkout (trader {traderId}) - multi-trader routing is a later
        milestone.
      </p>
      {initError && (
        <p className="meta-line" role="status">Wallet init error: {initError}</p>
      )}
      {connecting && !initError && (
        <p className="meta-line" role="status">Connecting wallet service...</p>
      )}
    </div>
  );
}

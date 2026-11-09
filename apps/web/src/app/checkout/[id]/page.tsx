import { PLAN, getSeller } from '../../../fixture';
import { getWebConfig } from '../../../config';
import { checkoutMount } from '../../../checkoutMount';
import { CheckoutActions } from './CheckoutActions';
import { CheckoutTestnet } from './CheckoutTestnet';

/**
 * FAIL-CLOSED ORDER (KF-08b): the mode/config gate runs BEFORE any fixture
 * data is read. FIXTURE serves the clearly labeled demo. TESTNET mounts the
 * real read-only/wallet checkout. LIVE (and any invalid config) renders an
 * explicit explanation and mounts NOTHING testnet — no queries, no signing,
 * no fixture numbers.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cfg = getWebConfig();

  if (!cfg.ok) {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="page-title">Checkout</h1>
        <div className="panel note-error" role="status">
          <p className="terms-text">
            Configuration error: {cfg.error} — copy .env.example (in apps/web) to apps/web/.env.local and set KEYFOLIO_MODE.
            No order data is shown until the mode is configured.
          </p>
        </div>
      </section>
    );
  }

  const mount = checkoutMount(cfg.mode);

  if (mount === 'none') {
    return <CheckoutUnavailable title="Checkout unavailable" reason={`${cfg.mode} mode: checkout is wired for testnet only and no testnet component, query, or signing is mounted in this mode.`} />;
  }

  if (cfg.mode === 'TESTNET') {
    return <TestnetCheckout cfg={{ ok: true, mode: 'TESTNET', config: cfg.config }} />;
  }

  // FIXTURE
  const seller = getSeller(id);
  if (!seller || seller.id !== 'carla' || !seller.salesActive) {
    return (
      <CheckoutUnavailable
        title="Checkout unavailable"
        reason="This seller is not accepting purchases in the demo, or the profile does not exist."
      />
    );
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Checkout</h1>
      <p className="sample-note">Illustrative sample — FIXTURE demo, no real funds or signatures</p>
      <div className="checkout-wrap">
        <div className="card checkout-card">
          <h2 className="checkout-title">Buy access NFT — {seller.handle}</h2>
          <div className="checkout-rows">
            <p className="checkout-line">
              Term: {PLAN.termDays} days · {PLAN.termSeconds.toLocaleString('en-US')} seconds (plan configuration)
            </p>
            <p className="checkout-line">Price: {PLAN.priceLabel.replace(' KF-TEST', '.000000 KF-TEST')} (exact atomic amount: {PLAN.priceAtomic})</p>
            <p className="checkout-line">Storage deposit: {PLAN.storageNear}</p>
            <p className="checkout-line">Network: NEAR {PLAN.network} · FT: {PLAN.paymentToken}</p>
          </div>
          <div className="refund-note">
            <p>
              Prepaid funds vest linearly over 30 days. If service terminates, the unvested remainder is
              refunded to the current NFT owner.
            </p>
          </div>
          <CheckoutActions mode={cfg.mode} />
        </div>
      </div>
    </section>
  );
}

function CheckoutUnavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">{title}</h1>
      <p className="meta-line">
        {reason}{' '}
        <a href="/">Back to Marketplace</a>
      </p>
    </section>
  );
}

function TestnetCheckout({ cfg }: { cfg: { ok: true; mode: 'TESTNET'; config: { network: string | null } } }) {
  const accessContract = process.env.NEXT_PUBLIC_ACCESS_CONTRACT_ID ?? 'keyfolio-access.testnet';
  const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC_URL ?? 'https://rpc.testnet.near.org';
  const traderId = process.env.NEXT_PUBLIC_DEMO_TRADER_ID ?? 'keyfolio-ops.testnet';
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Checkout</h1>
      <p className="sample-note">TESTNET · near {cfg.config.network} · read-only preflight + real wallet signing · no fixture numbers</p>
      <CheckoutTestnet rpcUrl={rpcUrl} accessContract={accessContract} traderId={traderId} />
    </section>
  );
}
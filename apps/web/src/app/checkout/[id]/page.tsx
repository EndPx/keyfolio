import { PLAN, getSeller } from '../../../fixture';
import { getWebConfig } from '../../../config';
import { CheckoutActions } from './CheckoutActions';

/**
 * FAIL-CLOSED ORDER (review KF-08b.1): the mode/config gate runs BEFORE any
 * fixture data is read or rendered. TESTNET/LIVE (and invalid configs) never
 * see the fixture seller, plan or order rows — only an explicit explanation
 * of what is missing.
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

  if (cfg.mode !== 'FIXTURE') {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="page-title">Checkout</h1>
        <div className="panel note-error" role="status">
          <p className="terms-text">
            {cfg.mode} mode is active: the checkout flow is not wired to wallet signing or contract
            queries yet (next KF-08b increment), and fixture order data is never served in this
            mode. Connect the plan query and wallet path to enable real checkout.
          </p>
        </div>
      </section>
    );
  }

  const seller = getSeller(id);
  if (!seller || seller.id !== 'carla' || !seller.salesActive) {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title" className="page-title">Checkout unavailable</h1>
        <p className="meta-line">
          This seller is not accepting purchases in the demo, or the profile does not exist.{' '}
          <a href="/">Back to Marketplace</a>
        </p>
      </section>
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

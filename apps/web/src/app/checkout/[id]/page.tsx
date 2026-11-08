import { PLAN, getSeller } from '../../../fixture';
import { getWebConfig } from '../../../config';
import { CheckoutActions } from './CheckoutActions';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = getSeller(id);
  const cfg = getWebConfig();
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
  const mode = cfg.ok ? cfg.mode : null;
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Checkout</h1>
      <p className="sample-note">Illustrative sample — FIXTURE demo, no real funds or signatures</p>
      <div className="checkout-wrap">
        <div className="card checkout-card">
          <h2 className="checkout-title">Buy access NFT — {seller.handle}</h2>
          <div className="checkout-rows">
            <p className="checkout-line">Term: 30 days · 2,592,000 seconds (plan configuration)</p>
            <p className="checkout-line">Price: 25.000000 KF-TEST (exact atomic amount: {PLAN.priceAtomic})</p>
            <p className="checkout-line">Storage deposit: {PLAN.storageNear}</p>
            <p className="checkout-line">Network: NEAR {PLAN.network} · FT: KF-TEST (testnet mock)</p>
          </div>
          <div className="refund-note">
            <p>
              Prepaid funds vest linearly over 30 days. If service terminates, the unvested remainder is
              refunded to the current NFT owner.
            </p>
          </div>
          <CheckoutActions mode={mode} />
        </div>
      </div>
    </section>
  );
}

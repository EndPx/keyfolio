/**
 * Private Account (KF-08b.3): entitlement-gated account data. The ingestion
 * backend (KF-01 provider access, KF-03 ingestion loop) is not wired, so the
 * honest state is an explicit not-connected panel — never fake trades.
 */

export default function PrivateAccountPage() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">Private Account</h1>
      <div className="panel">
        <h2 className="panel-title">Not connected</h2>
        <p className="terms-text">
          This screen shows the traded account&apos;s activity, balances and positions behind the
          NFT entitlement check. It requires the ingestion backend (provider access KF-01 and the
          ingestion loop KF-03), which is not wired into this prototype milestone — fixture data is
          deliberately not shown here.
        </p>
        <p className="meta-line">
          What exists today: the access contract on testnet (purchase/withdraw/refund flows) and the
          reconciliation rules tested in the workspace. This screen lights up when the ingestion
          backend lands.
        </p>
      </div>
    </section>
  );
}

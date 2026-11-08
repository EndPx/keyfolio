/**
 * API Access (KF-08b.3): credential create/revoke is a backend service
 * (session auth + keyed hashing, KF-06 server wiring) that is not part of
 * this prototype milestone — the honest state is an explicit explanation.
 */

export default function ApiAccessPage() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="page-title">API Access</h1>
      <div className="panel">
        <h2 className="panel-title">Credential service not connected</h2>
        <p className="terms-text">
          API credentials are created and revoked by the backend (session auth, keyed hashing,
          per-license quota 60 req/min · burst 10 · max 5 credentials). That service is not wired
          into this prototype milestone — no demo credentials are shown, because secrets shown in a
          demo would be fake either way.
        </p>
        <p className="meta-line">
          Design reference: the approved mockup shows the full credential table, create-once secret
          flow and a curl example with a placeholder key.
        </p>
      </div>
    </section>
  );
}

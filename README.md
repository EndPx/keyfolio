# Keyfolio

**Performance in public. Strategy by invitation.**

Keyfolio lets a trader authorize access to one NEAR Confidential Intents account. Followers buy a transferable, time-limited NEAR Access NFT to read its authorized activity through a dashboard and API. Public performance is derived from reconciled account data. Assisted copy uses the follower's funds and a fresh explicit signature.

Current state: planning and workspace bootstrap. No application, contract deployment, authenticated account ingestion or end-to-end integration has been accepted. See [current status](docs/status.md) before interpreting this repository as a working product.

## Start here

- [Product baseline](docs/planning/keyfolio-v1/01-PRODUCT-AND-ENGINEERING-SPEC.md) and [acceptance matrix](docs/planning/keyfolio-v1/02-TASKS-AND-ACCEPTANCE.md)
- [Binding decisions](docs/decisions.md)
- [Architecture and authority boundaries](docs/architecture.md)
- [Database design and on-chain/off-chain placement](docs/database.md)
- [Design system](DESIGN.md)
- [Task status and evidence](docs/status.md)
- [Agent recovery instructions](AGENTS.md)

## Planned workspace

`apps/web` (Next.js), `apps/api` (Fastify), `apps/worker` (ingestion/reconciliation), `contracts/access` (Rust/near-sdk), `packages/domain` (pure rules), `packages/provider-adapter` (server-only upstream boundary), `packages/api-contract` (wire schemas/OpenAPI).

These modules will be added in KF-02; this documentation does not imply they exist. Selected baseline: pnpm TypeScript workspace, PostgreSQL, NEAR sandbox and Playwright. Exact dependency pins are accepted only after installation/build verification.

## Boundaries

Account-following does not imply coverage of unrelated wallets or protocols. Upstream permissions and account-wide history remain an external gate. Backend operators process authorized plaintext data; subscribers can retain downloaded information, and public NFTs can reveal subscription relationships. NFT access does not grant trading authority. The subscription contract holds prepaid subscription liabilities; Keyfolio does not hold trader/follower trading keys.

No public paid service, audited-security claim, mainnet transaction or live performance claim is established by this repository.

# Keyfolio design system v1

Status: selected design contract for implementation, 2026-11-06. Browser/component QA has NOT_RUN; no finished frontend is claimed.

## 0. Research log

Product constraints: traders disclose authorized account data; followers compare coverage/performance before purchasing access. The interface must distinguish data freshness, activity age, financial outcomes and permissions.

Local ui-ux-pro-max search: `trading analytics dashboard trust --design-system -p Keyfolio`. Result mixed useful data-legibility guidance with an unsuitable enterprise Contact Sales landing pattern. Rejected the landing pattern and generic dark/glow styling. Kept tabular financial legibility, keyboard focus and explicit data states. Palette/type below are deliberate Keyfolio choices.

Embedded shortlist: Revolut (financial tasks), Linear (dense navigation), Stripe (payment clarity). Their indexed Layer B files and selected minimalist Layer A file are absent from the installed reference bundle; recorded unavailable rather than claiming inspection. General frontend-design guidance was read. No brand assets/copy are borrowed.

Spatial reference: [StyleGallery fixed-sidenav-shell](https://raw.githubusercontent.com/changeroa/StyleGallery/main/patterns/viewport-shell/fixed-sidenav-shell.md). Adopt stable desktop navigation and one main scroll owner, with normal document flow on mobile. Reference is structural, not a palette source.

Logo: ChatGPT Image original transparent raster master, navy/cobalt key in portfolio/book negative space. Saved under `assets/brand/`. Generated raster is not an editable vector master. Logo polish and small-size browser review remain pending.

Lazyweb/Imagen screen drafts and rendered primitive exploration are deferred to the UI milestone; no visual research completion or production-screen QA is claimed here. This milestone establishes the documentation contract, not product screens.

## 1. Atmosphere and product hierarchy

Calm financial research workspace: light cool background, navy typography, cobalt actions. Use clear rows, well-spaced financial columns and restrained panels. Public discovery emphasizes comparable coverage and subscription terms; private account emphasizes chronology and readable balances. The recognizable brand gesture is the key/portfolio mark, not decorative gradients or speculative charts.

Prioritize profile identity -> coverage and freshness -> performance with period -> price/rights -> purchase. Show `Tracked performance`, not `Verified profit`. No decorative fake balances, testimonial statistics or chart history.

## 2. Color

| Token | Value | Meaning |
|---|---|---|
| --surface-page | #F5F7FB | Cool page background |
| --surface-panel | #FFFFFF | Primary content |
| --surface-subtle | #EDF2F8 | Secondary grouping |
| --text-primary | #142B45 | Main navy text |
| --text-secondary | #52647A | Supporting text |
| --border-subtle | #D6DFEA | Structural separators |
| --border-control | #74859A | Input boundary |
| --action | #2457D6 | Primary button/link/focus |
| --action-hover | #1B43A8 | Hover/active |
| --on-action | #FFFFFF | Action foreground |
| --positive | #167348 | Positive financial outcome |
| --positive-bg | #EAF6EF | Positive state background |
| --negative | #B33838 | Negative result/destructive action |
| --negative-bg | #FCEEEE | Negative state background |
| --warning | #875300 | Stale/attention |
| --warning-bg | #FFF4D8 | Warning background |

Semantic state always includes text/icon; green does not mean data is proven. Neutral zero uses text-secondary. Environment banner names FIXTURE/TESTNET/LIVE and network. Exact palette contrast is checked in primitive QA before screens are accepted. No dark mode in v1 until a separately tested token set exists.

## 3. Typography

Primary: IBM Plex Sans, self-hosted with license when installed; fallback system-ui/sans-serif. Numbers use tabular-nums and lining-nums. IBM Plex Mono is restricted to addresses, token IDs and curl examples; fallback ui-monospace. Font acquisition/version/license verification belongs to KF-02 UI setup; no external font fetch at runtime by default.

| Token | Size / line height | Role |
|---|---|---|
| --type-caption | 12/18px | Secondary timestamps, never essential instructions |
| --type-small | 14/20px | Table cells/labels |
| --type-body | 16/24px | Body/form input |
| --type-title-small | 20/28px | Section title |
| --type-title | 28/36px | Page title |
| --type-display | 40/48px | Public introduction, 32/40 mobile |

Weights400/500/600. Sentence case. Right-align comparable amounts, retain full precision on demand and explicitly label display rounding. Monetary values originate as strings; formatting must not convert through float. Missing metric is an em dash with reason, never0.

## 4. Spacing and layout

Spacing tokens: 4,8,12,16,24,32,48,64px. Corners: control6px, panel12px, badge999px. Icon16/20px; control minimum44px touch target. Main content max1280px, desktop gutter32px, mobile16px. Desktop navigation232px; header64px. Breakpoints640/768/1024/1280px. Test375,390,768,1280,1440px.

Desktop app: navigation + minmax(0,1fr) main; main is the sole page scroll container with min-height:0. Keep primary actions in normal content flow. Below1024px navigation becomes a labeled menu/drawer with focus return; document owns scroll. Tables may own a labeled horizontal scroll region; primary content must not overflow the page. Account addresses wrap or truncate with an accessible copy/full-value action.

Discovery uses aligned comparison rows on desktop and stacked summaries on mobile. Profile and private account use dominant content plus a supporting subscription/account-status rail; the rail stacks below content on narrow screens. Preserve reading/focus order in DOM.

## 5. Initial primitives and state contract

Implement primitives inside apps/web first; no shared UI package without a real second consumer. Build a nonpublic fixture-only showcase before product screens.

| Primitive | Anatomy / variants | Required states and accessibility |
|---|---|---|
| Button | Text + optional SVG icon; primary/secondary/destructive | default/hover/pressed/focus/disabled/pending; stable width, announced pending |
| FormField | label, input, hint, inline error | empty/filled/invalid/disabled; associated descriptions, no placeholder-only label |
| DataStatus | icon + plain-language label + timestamp/reason | healthy-idle/stale/reauth/incomplete/terminated; no color-only state |
| Metric | label, period, value, coverage note | positive/negative/zero/unavailable/loading; accessible equivalent for chart |
| LicenseSummary | trader, owner-context, expiry, rights/action | active/expired/pending-transfer/disabled; expiry timezone explicit |
| ActivityRow | asset movement, source time/status, optional copy action | pending/confirmed/failed/refunded/quarantined; copy-disabled reason |
| Dialog | heading, description, content, cancel/confirm | initial focus, trapped focus, Escape where safe, focus return |
| EnvironmentBanner | mode + network | always visible for environment context; no private internals |

Private views have loading/empty/denied/expired/stale/upstream-error/retry states. Never briefly render private data before entitlement confirmation. Idle copy: `No trades in this period. Account data is up to date.` Backfill copy denial: `This trade is outside the copy window.` Untrusted time: `Copy unavailable: execution time could not be verified.`

## 6. Motion and interaction

Micro120ms ease-out; panel180ms ease-out. Only opacity/transform; no auto-running decorative movement. Pending feedback explains state without implying settlement. Reduced-motion eliminates nonessential transitions. New activity must not steal focus or reset pagination. No GSAP dependency is needed for this initial system.

## 7. Depth and surface

White panels over cool background, subtle dividers. No shadow on ordinary rows/cards. Overlay shadow only: 0 12px 32px rgba(20,43,69,.14). Avoid nested card forests; related financial fields share one section/table. Focus ring2px action with2px offset; outlines must remain visible in forced-colors mode.

## 8. Accessibility constraints and open validation

WCAG2.2 AA target: text4.5:1, large text3:1, controls/focus3:1; complete keyboard access, labeled SVG icons, skip link, table headers, chart text alternative, 200% zoom/reflow, reduced motion. Confirm wallet dialogs and transaction states with keyboard, not screenshots alone. Signing and retry instructions must be understandable without blockchain implementation details.

Open validation: no product UI or primitive showcase yet; font licensing/install, measured contrast, mobile/tablet/desktop states and logo small-size QA remain NOT_RUN. These are required implementation checks, not accepted production debt. No user-approved accessibility exceptions.

## 9. Landing and curved-surface direction (KF-D017)

The first public web surface is a motion-led landing page in a separate
`apps/landing` application. Its job is to explain
the product promise, prove that the metrics are tracked rather than seller-entered,
and route the visitor to either `Connect NEAR wallet` or `Explore traders`. The
landing page uses the approved KF-D016 Xorr-inspired dark language, but it is a
marketing surface rather than an app-shell screen.

The landing contract is captured in `design/mockups/keyfolio-screens-v1.figcraft`
as `Screen / 00 Landing desktop 1440`. The memorable moment is a floating tracked
performance card over a cobalt atmospheric orb, with a rounded equity ribbon. The
copy remains Keyfolio-owned; Xorr assets, logos and product claims are not copied.

Landing tokens:

- true black canvas, `#0C0C0D` floating card, hairline white rim, cobalt glow,
  green P&L only;
- 72px desktop hero / 44px mobile hero, Inter 700; Baloo 2 remains wordmark-only;
- 36px card radius, 30px CTA radius, 20px minimum text/interaction rhythm;
- motion is GPU-composited (`transform`, `opacity`, `filter`) and has a reduced-
  motion fallback. Motion must explain navigation, card focus, or data activity;
  decorative loops without user or data meaning are not permitted;
- the primary CTA is wallet-aware: FIXTURE exposes a labeled simulated state,
  TESTNET opens the existing NEAR Wallet Selector, and LIVE remains fail-closed;
- dashboard panels keep the rounded sheet/card grammar. Sharp rectangular blocks
  are reserved for chart geometry, table dividers and focus outlines.

Landing responsive states are required at 375px, 390px, 768px, 1280px and 1440px.
The hero stacks on narrow screens, preserves the wallet CTA in the first viewport,
and keeps the floating performance card readable without horizontal overflow.

The landing page uses a deliberate 70/20/10 composition:

- **70% primary:** black canvas, white display type, and the main narrative path;
- **20% support:** dark rounded panels, muted explanatory copy, navigation and
  scenario steps;
- **10% impression:** cobalt/lilac glow, animated ribbon, cursor-catching CTA
  treatment and generative visual texture.

The 10% impression layer may feel intentionally expressive or AI-generated, but it
must stay tied to a product scenario and never fabricate live trader results. The
landing narrative is: choose a trader → inspect tracked coverage/performance → buy
the access NFT key → unlock private account/API views → use assisted copy only when
source time and entitlement rules allow it, with the follower signing from their
own wallet. The dashboard is an app surface and keeps the quieter rounded data
workspace grammar.

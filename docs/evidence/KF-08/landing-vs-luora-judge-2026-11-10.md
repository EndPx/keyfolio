# Keyfolio vs Luora frontend judge

**Date:** 2026-11-10 (Asia/Jakarta)  
**Review type:** review-only visual comparison  
**Scope:** current sparse-hero cleanup, local Luora reference evidence, current 1440/390 captures, current landing source  
**Decision:** **Loose inspiration only; not genuinely comparable to Luora yet**  
**Parity score:** **6.4/10**

No source files were edited for this review. No commit or push was performed.

## Evidence reviewed

- Luora desktop reference: `.deploy-local/luorasec-1440.png`
- Luora motion reference: `.deploy-local/motion-audit/luora-motion.webm`
- Keyfolio cleanup desktop capture: `.deploy-local/motion-audit-cleanup/keyfolio-landing-cleanup-final.png`
- Keyfolio cleanup reduced-motion desktop capture: `.deploy-local/motion-audit-cleanup/keyfolio-landing-cleanup-reduced-final.png`
- Keyfolio cleanup normal-motion WebM: `.deploy-local/motion-audit-cleanup/page@0fffb29342f018c2655db384bc59abec.webm`
- Keyfolio cleanup reduced-motion WebM: `.deploy-local/motion-audit-cleanup/page@179e984d7d550cd8de89558190c8b68a.webm`
- Current cleanup 1440/390/reduced captures: `docs/evidence/KF-08/landing-cleanup/`
- Current implementation: `apps/landing/src/components/LandingClient.tsx`, `apps/landing/src/app/globals.css`
- Cleanup record: `docs/evidence/KF-08/landing-hero-cleanup-2026-11-10.md`

The Luora PNG is a 1440px-wide, very tall full-page reference. The Keyfolio cleanup PNG is also a full-page capture, but it is substantially shorter and more information-dense. The 390px Keyfolio cleanup capture is available under `docs/evidence/KF-08/landing-cleanup/landing-390.png`; there is no equivalent Luora mobile capture in the supplied reference set, so mobile parity is judged against the desktop motion language and Keyfolio’s own responsive behavior.

## Judge read

Keyfolio now has a coherent visual identity. The cleanup removed the earlier hero status clutter, sample metrics, and visible evidence taxonomy. The first viewport is easy to parse: a large two-line promise, a bright key/globe artifact, one primary route (**Browse traders**), one secondary demo action, and a framed state card. The desktop and mobile captures are readable, overflow-free, and visually consistent.

That is a meaningful improvement, but it does not produce Luora-level parity. Luora’s reference is built around a sequence of sparse, centered visual scenes: a contract graph, a single network relationship, a four-card scenario around a central action, and a later numbered layer sequence. Large areas of black space are part of the composition and create anticipation. The motion evidence reinforces that structure by introducing and repositioning a small number of objects as a guided narrative.

Keyfolio uses the same broad ingredients—black canvas, cool blue accents, soft glow, oversized display text, rounded dark surfaces—but its page is organized as a conventional product landing: a two-column hero followed by five process cards, three proof cards, a final CTA, and footer labels. The page is more explanatory and more compact. Its motion is primarily scroll progress plus section reveal, with modest artwork/card transforms. It explains the journey; it does not yet stage the journey with the same cinematic pacing.

## Criterion scorecard

| Criterion | Score | Finding |
|---|---:|---|
| Canvas and density | 5.5/10 | Both use a black canvas, but Luora is intentionally sparse and tall, with long pauses between visual beats. Keyfolio fills the page with a tighter stack of hero, process cards, proof cards, and CTA. The result feels like a polished landing template beside Luora’s editorial sequence. |
| Focal 3D/artifact treatment | 7.0/10 | Keyfolio’s generated key/globe artwork is distinctive and clearly tied to account access. It is a strong focal asset. The treatment remains a raster image inside a rounded stage, while Luora’s diagrams and cards feel native to the scene and carry the product interaction itself. |
| First-frame hook | 7.5/10 | Keyfolio opens with readable contrast, a strong promise, and the artifact visible immediately. The cleanup fixed the previous dim/loading impression. Luora’s opening hook is more product-specific because the graph UI is already the thing being explained; Keyfolio’s art is memorable but initially more symbolic. |
| Motion choreography | 5.5/10 | Keyfolio source uses IntersectionObserver reveals, a pulsing orbit, a short art settle, and scroll-linked five-state transforms. These are valid motions, but they are small and mostly additive. Luora’s motion creates distinct scenes and object relationships. Keyfolio does not yet provide an equivalent sequence of clear entrances, handoffs, or compositional re-centering. |
| Section pacing | 5.5/10 | Keyfolio moves directly from hero to a full five-row process rail, then three proof cards, then CTA. Luora uses fewer, larger narrative moments with much more air. Keyfolio’s pacing is efficient; it is not Luora-like. |
| Whitespace | 5.0/10 | Keyfolio has generous padding but little true negative-space staging. Luora uses emptiness as a primary motion and hierarchy tool. This is the largest canvas-level parity gap. |
| CTA hierarchy | 7.5/10 | Keyfolio makes **Browse traders** the clear primary action and keeps **Open the demo** secondary. The nav’s **Open app** is subordinate. This is disciplined and comparable in intent to Luora’s **Launch app** plus quieter secondary actions. |
| Typography scale | 7.0/10 | Keyfolio’s display type is large, bold, and well prioritized; the 390px version preserves the hierarchy. It is heavier and more compressed than Luora’s lighter rounded display treatment, and the many small labels below the hero introduce more UI texture. |
| Rounded surface language | 8.0/10 | Framed stage, artifact card, process cards, proof cards, and CTA all use a consistent rounded dark-surface grammar. This is the strongest direct visual match, although Keyfolio uses more card surfaces overall. |
| Mobile behavior | 7.5/10 | The cleanup 390px capture keeps the headline, CTAs, artwork, artifact state, process sequence, proof cards, and final CTA readable with no horizontal overflow. The page is long and card-heavy, while Luora’s supplied evidence does not establish a mobile equivalent. Keyfolio passes responsive quality locally; parity remains unproven. |

### Why the score is 6.4

The score gives credit for the shared dark, rounded, premium direction and for a materially improved first frame. It is held below 7 because Luora’s distinctive quality is not its color palette; it is the relationship between sparse composition, object staging, and motion. Keyfolio currently borrows the surface language while keeping a denser, more conventional information architecture.

## Concrete gaps

### P0 — close before calling the landing Luora-comparable

1. **The motion does not carry the narrative strongly enough.**  
   `LandingClient.tsx` changes `activeStep` from scroll position and applies small translate/scale/filter changes to `.hero-art` and `.proof-artifact`. The orbit pulse and 300ms settle add atmosphere, but the artifact does not visibly transform into five distinct scenes. Luora’s motion evidence uses scene changes as the product explanation. Keyfolio needs at least three visibly different compositional states in the recorded motion: the initial trader/account relationship, the access-key transition, and the private/copy-eligible state. A label change plus a few percent of scale is not enough.

2. **The page is too dense to match Luora’s pacing.**  
   The five process cards are all present as a vertical UI list immediately after the hero, followed by three proof cards. Luora’s reference gives each idea more spatial ownership. If parity is the goal, collapse or stage the process so one state occupies the viewport at a time and the next state enters through motion, instead of presenting all five cards as a list.

3. **The focal artifact is framed like a dashboard panel rather than integrated into the scene.**  
   The large generated image is visually appealing, but the browser capture reads as “image inside bordered panel, card below.” Luora’s graph, nodes, and scenario cards are the scene. The Keyfolio key/globe object needs stronger spatial relationship to the headline and state transition: object travel, card docking/undocking, or a visibly changing connection path.

### P1 — important for a credible parity pass

1. **Increase intentional negative space between narrative beats.**  
   Keep the black canvas, but let the hero resolve before the next section arrives. The current process heading and rail begin quickly and make the page feel like a normal marketing stack. Longer pauses, centered statements, or a single object in a large field would move the composition toward Luora.

2. **Reduce simultaneous labels and card chrome.**  
   The cleanup correctly removed the worst hero clutter, but the page still exposes five numbered rows, three proof-card labels, multiple kicker labels, footer taxonomy, and a persistent state card. Luora uses labels sparingly. Reserve small uppercase text for orientation and let the artifact and primary sentence do more work.

3. **Make the artwork state changes legible in the WebM, not only in source.**  
   The cleanup folder contains the normal and reduced WebM recordings under generated `page@...` names. The final review should verify that a judge can see at least one state transition without reading source or scrubbing frame-by-frame. The reduced-motion file should preserve the state and hierarchy while removing only nonessential movement.

4. **Give the hero a stronger product-specific first visual.**  
   The current key/globe artwork is symbolic. Add one restrained, legible relationship cue—such as a trader node resolving into an access key or a tracked path locking to the card—so the first frame communicates what the artifact does, not only what it looks like.

5. **Tighten mobile pacing after the hero.**  
   The 390px cleanup is readable, but the five cards consume a large continuous block. Keep the stack accessible, while shortening supporting copy and using one stronger active state so the page does not feel like a long checklist.

### P2 — polish after the structural work

1. Lighten the display weight or loosen the letter spacing slightly in the largest Keyfolio headlines if the goal is closer typographic kinship with Luora.
2. Quiet the footer phrases (`account-following with proof`, `Consent / observations / access / eligibility`) so they do not read as internal taxonomy.
3. Keep the consistent rounded language, but vary scale more deliberately: one dominant stage, fewer same-radius cards, and less repeated bordered rectangles.
4. Retain the reduced-motion fallback and the truthful hidden status region; these are good implementation choices and should survive any visual revision.

## Decision

**Decision: do not describe the current Keyfolio landing as genuinely comparable to Luora. Describe it as a strong, Keyfolio-owned implementation loosely inspired by Luora’s dark visual direction.**

The current landing is visually credible and locally responsive. It has a clear hero, a good primary CTA, a distinctive artifact, and a coherent rounded surface system. It is suitable as a polished prototype in its current state.

It is not yet a parity match because the defining Luora qualities—extreme sparse composition, scene-level pacing, and motion that visibly stages the product model—remain underdeveloped. A parity claim should wait until the motion evidence shows distinct artifact states and the page gives fewer ideas more spatial and temporal ownership.

## Evidence boundary

This is a local visual review of screenshots, WebM captures, and source. It does not establish wallet signing, access-key purchase, private/API entitlement, provider access, assisted-copy execution, or LIVE readiness.

# Keyfolio landing hero refinement

Date: 2026-11-10 (Asia/Jakarta)

This iteration responds to the Xorr reference review. The previous landing hero
used only a CSS orb and ribbon, which made it read like a dashboard marketing
header. The new hero uses a generated focal artwork with a dark text-safe field,
then layers the proof card, ribbon and CTA on top.

## Visual source and evidence

- Reference inspected directly at `https://xorr.finance/` with Edge/Playwright:
  HTTP 200, title `xorr — A bot that trades while you get on with your life`,
  one hero heading, zero browser console errors in the captured pass.
- Official Xorr design tokens were also consulted from
  `https://raw.githubusercontent.com/nickthelegend/xorr-solana/main/ui/mobile-ui/design.md`.
- REA `rea-agents` was installed globally and Codex setup was aligned. A bounded
  REA browser scenario against `xorr.finance` was attempted, but the Windows
  browser provider returned `execution_failure` with incomplete cleanup. No REA
  result is presented as visual evidence; the direct Playwright capture and
  official token document remain the sources for this iteration.
- Generated asset: `apps/landing/public/hero-keyfolio.png`.
  SHA-256 observed in this checkout: `B4AE1E3068E9252D4CC9190B02AC709474399BCF65C8994FEA2851087B87028B`.

## Motion contract

- focal artwork moves through pointer/scroll parallax using transform only;
- hero sheen and ribbon use transform/filter/opacity;
- existing reveal/card/orb motion remains active;
- reduced-motion disables nonessential motion and keeps the art readable;
- image dimensions and crop are explicit to avoid layout shift and horizontal
  overflow.

## Validation

The landing evidence script reports marketing navigation present, no app sidebar or
environment banner, CTA visible, and `overflow=false` at 375/390/768/1280/1440px.
The workspace check after this iteration is **152/152 tests PASS**. The generated
visual remains illustrative; it does not represent live performance or provider
access.



## Plan: Redesign LandingPage Hero & Navbar

### 1. Append new CSS animations to `src/index.css`
Append after line 221: new keyframes (`shimmer-dark`, `fade-up`, `ecg-draw`, `shimmer-nav-border`) and utility classes (`.shimmer-text-dark`, `.shimmer-text-blue`, `.fade-up-1` through `.fade-up-5`, `.ecg-draw`, `.nav-cta-shimmer-wrap`). No existing classes removed.

### 2. Rewrite `src/pages/LandingPage.tsx` — Navbar
- Add `useState` for `mobileMenuOpen`
- Replace the `<header>` inner content with:
  - **Desktop/tablet**: Logo left, centre nav links (How it works / Features / Pricing), right actions (Give feedback green pill, Sign in solid blue, Request access with shimmer border wrap)
  - **Mobile (<768px)**: Logo + Sign in button + hamburger icon (3 spans). Hamburger toggles a dropdown with all nav links, feedback, and Request access button
- Centre links use `hidden md:flex`, right actions use `hidden md:flex`, mobile controls use `flex md:hidden`

### 3. Rewrite `src/pages/LandingPage.tsx` — Hero section
Replace the entire `<section id="hero">` with:
- **Early access badge** — green pill with pulse dot, `fade-up-1`
- **Logo lockup** — `<RotaGenLogo size="lg" />`, `fade-up-2`
- **Tagline** — three lines with `.shimmer-text-dark` on "ROTA" and `.shimmer-text-blue` on "GEN", `fade-up-3`
- **Pricing card** — same content as current but with `fade-up-4`, rounded-2xl, early access badge, all three buttons preserved exactly
- **Mock rota** — `fade-up-5 float-anim`, responsive sizing (`max-w-xs` on mobile, `max-w-lg` on md+), includes window chrome dots + "RotaGen — Final Rota · August 2025" title, grid table, and an SVG ECG polyline with `.ecg-draw` animation
- Delete the old description paragraph (lines 193-195)

### 4. No other sections changed
How it works, Features, dark CTA, footer all remain untouched.

### Files modified
- `src/index.css` — append new animations
- `src/pages/LandingPage.tsx` — navbar + hero rewrite

### No backend changes


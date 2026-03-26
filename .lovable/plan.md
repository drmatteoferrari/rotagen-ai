

## Plan: RotaGen Brand Identity — Icon, Poppins Wordmark, and Tagline

### 1. `index.html` — Metadata + Poppins font
- Add Poppins 700 Google Fonts link in `<head>`
- Change `<title>` from "Lovable App" to "RotaGen — NHS Rota Scheduling"
- Replace `<meta name="description">` content to "WTR-compliant rotas generated automatically from your doctors' preferences."
- Replace all `content="Lovable App"` (og:title, twitter:title) with "RotaGen — NHS Rota Scheduling"
- Replace all `content="Lovable Generated Project"` (og:description, twitter:description) with the new description

### 2. New file: `src/components/brand/RotaGenIcon.tsx`
- SVG calendar icon with QRS-T ECG trace
- Props: `size` (default 44), `variant` ("light" | "dark")
- Variant-driven colour palette (blue/white for light, white/blue for dark)
- 12 grid cells (4×3), ECG polyline, two calendar notches, header line, outer frame

### 3. New file: `src/components/brand/RotaGenLogo.tsx`
- Combines RotaGenIcon + Poppins Bold wordmark
- Props: `size` ("sm" | "md" | "lg"), `variant`, `showIcon`
- Wordmark: "ROTA" in dark/white + "GEN" in blue/light-blue depending on variant

### 4. New file: `src/components/brand/RotaGenTagline.tsx`
- Props: `variant` ("full" | "short")
- Full: three lines — "Your doctors' preferences." / "Your department's rules." / "One **ROTA**. **GEN**erated for you."
- Short: single line with ROTA/GEN highlighted

### 5. `src/pages/LandingPage.tsx`
- Navbar: replace RE box + "RotaGen" text with `<RotaGenLogo size="sm" />`
- Hero: replace h1 three-line block with `<RotaGenLogo size="lg" />` + `<RotaGenTagline variant="full" />`

### 6. `src/pages/Login.tsx`
- Replace RE box + "RotaGen" + tagline with `<RotaGenLogo size="md" />` + `<RotaGenTagline variant="short" />`

### 7. `src/pages/ForgotPassword.tsx`
- Same replacement as Login

### 8. `src/pages/Register.tsx`
- Replace RE box + "RotaGen" + tagline with `<RotaGenLogo size="md" />`

### 9. `src/pages/Signup.tsx`
- Replace RE box + "RotaGen" + tagline with `<RotaGenLogo size="md" />`

### 10. `src/pages/Approve.tsx`
- Replace RE box + "RotaGen" + "Account Approval" with `<RotaGenLogo size="md" />`

### 11. `src/components/AdminShell.tsx`
- Replace Stethoscope logo block with: collapsed → `<RotaGenIcon size={28} variant="dark" />`, expanded → `<RotaGenLogo size="sm" variant="dark" />`
- Remove `Stethoscope` from lucide imports

### 12. `src/pages/Privacy.tsx` and `src/pages/Terms.tsx`
- Replace navbar RE box + "RotaGen" with `<RotaGenLogo size="sm" />`

### 13. `src/pages/Pricing.tsx`
- Navbar: replace RE box + "RotaGen" with `<RotaGenLogo size="sm" />`
- Hero card: replace RE box + "RotaGen" + tagline with `<RotaGenLogo size="md" />`

### Files created
- `src/components/brand/RotaGenIcon.tsx`
- `src/components/brand/RotaGenLogo.tsx`
- `src/components/brand/RotaGenTagline.tsx`

### Files modified
- `index.html`
- `src/pages/LandingPage.tsx`
- `src/pages/Login.tsx`
- `src/pages/ForgotPassword.tsx`
- `src/pages/Register.tsx`
- `src/pages/Signup.tsx`
- `src/pages/Approve.tsx`
- `src/components/AdminShell.tsx`
- `src/pages/Privacy.tsx`
- `src/pages/Terms.tsx`
- `src/pages/Pricing.tsx`

### No backend changes


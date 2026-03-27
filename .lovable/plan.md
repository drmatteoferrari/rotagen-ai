

## Plan: Shared Public Topbar Component

### What changes
Create a reusable `PublicTopBar` component and integrate it into all public pages, replacing their individual headers. The topbar uses a mobile-first layout on all screen sizes.

### New file: `src/components/PublicTopBar.tsx`

A shared sticky topbar component that accepts an optional `menuItems` prop for page-specific links shown in the hamburger dropdown.

**Layout (all screen sizes):**
```text
┌──────────────────────────────────────────────────┐
│ [Logo+ROTAGEN]   [★] [Sign in] [Request access] [≡] │
└──────────────────────────────────────────────────┘
```

- **Left**: RotaGenLogo (clickable → `/`), size "sm"
- **Right group** (all inline, responsive sizing):
  - Star icon button → `/feedback` (icon only, no text)
  - "Sign in" button → `/login` (compact on small screens)
  - "Request access" button → `/register` (compact on small screens)
  - Hamburger menu (3-bar) → toggles dropdown
- **Dropdown**: Shows page-specific `menuItems` passed as prop, plus default links (Home, Pricing, Privacy, Terms)
- Sticky, white/blur background, shadow on scroll (same style as existing headers)
- Hides "Sign in" button when current route is `/login`, hides "Request access" when on `/register`, hides star when on `/feedback`

**Props interface:**
```ts
interface PublicTopBarProps {
  menuItems?: { label: string; onClick: () => void }[];
}
```

### Files modified (7 pages):

1. **`src/pages/Login.tsx`** — Remove the existing Back button header and bottom tagline/footer section. Add `<PublicTopBar />` at the top. Remove the `ArrowLeft` import and the top header div. The page content (card) remains centered.

2. **`src/pages/Register.tsx`** — Replace the inline logo/back-button header with `<PublicTopBar />`.

3. **`src/pages/Pricing.tsx`** — Replace the entire `<header>` block with `<PublicTopBar menuItems={[...]} />`. Page-specific menu items: links to FAQ section, Features section on landing page.

4. **`src/pages/Privacy.tsx`** — Replace the `<header>` block with `<PublicTopBar />`. Menu items: Terms of Use link.

5. **`src/pages/Terms.tsx`** — Replace the `<header>` block with `<PublicTopBar />`. Menu items: Privacy Policy link.

6. **`src/pages/Feedback.tsx`** — Replace the sticky top bar div with `<PublicTopBar />`.

7. **`src/pages/Checkout.tsx`** — Add `<PublicTopBar />` above the existing content (currently has no topbar).

### NOT changed:
- **LandingPage.tsx** — Keeps its own header since it has scroll-to-section navigation specific to that page. The shared component is modeled after it but simplified.
- **Approve.tsx** — Admin-facing token page, not a typical public page.
- **ForgotPassword.tsx** — Will also get the topbar (8th page modified).

### Technical details
- The component uses `useLocation` to auto-hide contextually irrelevant buttons (e.g., no "Sign in" on login page)
- Button sizes adapt via Tailwind responsive classes (`text-xs sm:text-sm`, `px-2.5 sm:px-3`) to fit all items on small screens
- Hamburger dropdown uses the same pattern as LandingPage's mobile menu


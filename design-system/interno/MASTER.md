# Interno — Design System (Master)

Mobile-first OJT management platform. QR attendance, task monitoring, DTR approval, documents, reports, role-based access.

---

## Color System

### Primary Palette (Teal)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#0D9488` | Primary actions, active states, links |
| `--color-primary-hover` | `#0F766E` | Primary hover state |
| `--color-primary-light` | `#CCFBF1` | Primary background tints |
| `--color-on-primary` | `#FFFFFF` | Text on primary backgrounds |

### Secondary Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-secondary` | `#2DD4BF` | Secondary accents, badges, highlights |
| `--color-on-secondary` | `#0F172A` | Text on secondary backgrounds |

### Accent (Amber)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#D97706` | CTAs, important actions, warnings |
| `--color-accent-hover` | `#B45309` | Accent hover state |
| `--color-on-accent` | `#FFFFFF` | Text on accent backgrounds |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-destructive` | `#DC2626` | Delete, error, critical |
| `--color-destructive-hover` | `#B91C1C` | Destructive hover |
| `--color-on-destructive` | `#FFFFFF` | Text on destructive |
| `--color-success` | `#16A34A` | Success states, completed |
| `--color-warning` | `#D97706` | Warnings, pending review |
| `--color-info` | `#2563EB` | Informational, links |

### Surface Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-background` | `#F0FDFA` | `#0F172A` | Page background |
| `--color-foreground` | `#134E4A` | `#F0FDFA` | Primary text |
| `--color-card` | `#FFFFFF` | `#1E293B` | Card/panel background |
| `--color-card-foreground` | `#134E4A` | `#F0FDFA` | Card text |
| `--color-muted` | `#E8F1F4` | `#334155` | Muted backgrounds |
| `--color-muted-foreground` | `#475569` | `#94A3B8` | Secondary text |
| `--color-border` | `#5EEAD4` | `#334155` | Borders, dividers |
| `--color-input` | `#BDBDBD` | `#555555` | Input borders |
| `--color-ring` | `#0D9488` | `#2DD4BF` | Focus rings |

### Role-Based Colors (for badges/chips)

| Role | Background | Text |
|------|-----------|------|
| Admin | `#FEE2E2` | `#991B1B` |
| Coordinator | `#DBEAFE` | `#1E40AF` |
| Supervisor | `#FEF3C7` | `#92400E` |
| Trainee | `#D1FAE5` | `#065F46` |

---

## Typography

### Font Stack

```css
--font-display: 'Fira Sans', system-ui, sans-serif;
--font-body: 'Fira Sans', system-ui, sans-serif;
--font-mono: 'Fira Code', ui-monospace, monospace;
```

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display-lg` | 2.25rem (36px) | 700 | 1.2 | Page titles |
| `display-md` | 1.875rem (30px) | 700 | 1.25 | Section headers |
| `display-sm` | 1.5rem (24px) | 600 | 1.3 | Card titles |
| `heading` | 1.125rem (18px) | 600 | 1.4 | Subsection headers |
| `body-lg` | 1rem (16px) | 400 | 1.5 | Body text |
| `body` | 0.875rem (14px) | 400 | 1.5 | Default body |
| `body-sm` | 0.8125rem (13px) | 400 | 1.5 | Helper text, labels |
| `caption` | 0.75rem (12px) | 400 | 1.5 | Timestamps, captions |
| `mono` | 0.875rem (14px) | 500 | 1.5 | Code, IDs, QR data |

### Rules
- All headings are roman (no italic headers)
- Body text: `font-size: 16px` minimum on inputs (prevents iOS zoom)
- Line height: 1.5 for body, 1.2-1.3 for display

---

## Spacing Scale

Based on 4px grid:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | `0px` | — |
| `--space-1` | `4px` | Tight gaps |
| `--space-2` | `8px` | Component inner padding |
| `--space-3` | `12px` | Compact spacing |
| `--space-4` | `16px` | Standard padding |
| `--space-5` | `20px` | Medium gaps |
| `--space-6` | `24px` | Section padding |
| `--space-8` | `32px` | Large gaps |
| `--space-10` | `40px` | Section dividers |
| `--space-12` | `48px` | Major sections |
| `--space-16` | `64px` | Page-level spacing |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Small elements (badges, chips) |
| `--radius-md` | `8px` | Buttons, inputs |
| `--radius-lg` | `12px` | Cards, panels |
| `--radius-xl` | `16px` | Modals, large cards |
| `--radius-full` | `9999px` | Pills, avatars |

---

## Shadows

Flat design — minimal shadows. Use borders instead.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (cards) |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdown menus |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |

---

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `150ms` | Hover states, micro-interactions |
| `--duration-normal` | `200ms` | Transitions, reveals |
| `--duration-slow` | `300ms` | Page transitions, modals |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Exiting elements |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | State changes |

### Rules
- No animation on page load (except skeleton loaders)
- `prefers-reduced-motion: reduce` — disable all non-essential motion
- Modal enter: fade + scale 0.95 → 1 (150ms)
- Modal exit: fade out (100ms)
- Toast enter: slide up + fade (200ms)
- Toast exit: slide right + fade (150ms)

---

## Component Patterns

### Cards
- Background: `var(--color-card)`
- Border: `1px solid var(--color-border)`
- Border radius: `var(--radius-lg)` (12px)
- Padding: `var(--space-4)` to `var(--space-6)`
- Shadow: `var(--shadow-sm)` (optional)

### Buttons

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `--color-primary` | White | None |
| Secondary | Transparent | `--color-primary` | `--color-primary` |
| Danger | `--color-destructive` | White | None |
| Ghost | Transparent | `--color-foreground` | None |

- Height: `40px` (desktop), `44px` (mobile)
- Padding: `0 16px` to `0 24px`
- Font: `body` weight `500`
- Border radius: `var(--radius-md)` (8px)
- Transition: `150ms ease`

### Inputs
- Height: `40px` (desktop), `48px` (mobile — bigger touch target)
- Border: `1px solid var(--color-input)`
- Border radius: `var(--radius-md)` (8px)
- Padding: `0 12px`
- Font size: `16px` minimum (prevents iOS zoom)
- Focus: `2px solid var(--color-ring)` with offset

### Tables
- Horizontal scroll wrapper on mobile (`overflow-x-auto`)
- Header: `--color-muted` background
- Rows: alternating `--color-card` / transparent
- Borders: `1px solid var(--color-border)` on cells

---

## Layout

### Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets, small laptops |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

### Mobile-First Rules
- Default styles target mobile (375px+)
- `md:` prefix for tablet (768px+)
- `lg:` prefix for desktop (1024px+)
- Sidebar navigation on desktop → bottom nav or hamburger on mobile
- Full-width cards on mobile → grid on desktop

### Grid
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3-4 columns
- Gap: `var(--space-4)` to `var(--space-6)`

---

## Accessibility

- Contrast ratio: 4.5:1 minimum for text
- Focus rings: visible on all interactive elements
- Keyboard navigation: all actions reachable via Tab/Enter
- Screen reader: proper ARIA labels on all interactive elements
- `prefers-reduced-motion`: disable animations
- Touch targets: minimum 44x44px

---

## Dark Mode

- Class-based (`.dark` on `<html>`)
- Toggle in header/settings
- All tokens have light/dark variants
- System preference: `prefers-color-scheme: dark`

---

## Icons

- SVG only (no emoji as icons)
- Recommended: Lucide React or Heroicons
- Size: 16px (inline), 20px (buttons), 24px (navigation)

---

## Existing Libraries (Keep)

| Library | Purpose | Status |
|---------|---------|--------|
| Recharts | Charts/dashboards | Keep |
| Framer Motion | Animations | Keep |
| dnd kit | Drag and drop | Keep |
| html5-qrcode | QR scanning | Keep |
| qrcode.react | QR display | Keep |
| jsPDF + xlsx | PDF/Excel export | Keep |

---

## Anti-Patterns to Avoid

1. No emojis as icons — use SVG
2. No `100vh` for app shell — use `100dvh`
3. No un-gated `:hover` — use `@media (hover: hover)`
4. No `user-scalable=no` — fix input font size instead
5. No placeholder-only labels — always visible labels
6. No raw hex in components — use tokens
7. No italic headers — emphasis via weight/color
8. No desktop-first CSS — mobile-first always

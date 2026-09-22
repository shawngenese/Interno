# Forms — Page Overrides

Overrides MASTER.md for form views (create/edit modals).

---

## Modal Container

- Desktop: centered, `max-w-lg` (512px), max `85vh` height
- Mobile: full viewport
- Animation: fade + scale 0.95 → 1 (150ms)
- Backdrop: `rgba(0,0,0,0.5)`

---

## Form Layout

- Single column on all screens
- Field spacing: `var(--space-5)` (20px)
- Section spacing: `var(--space-6)` (24px)
- Field width: 100%

---

## Labels

- Position: above input (not floating)
- Font: `body-sm` weight `500`
- Color: `--color-foreground`
- Required indicator: red asterisk `*` after label
- Margin bottom: `var(--space-1)` (4px)

---

## Inputs

- Height: `40px` desktop, `48px` mobile
- Border: `1px solid var(--color-input)`
- Border radius: `var(--radius-md)` (8px)
- Padding: `0 12px`
- Font size: `16px` minimum (prevents iOS zoom)
- Background: `--color-card`
- Focus: `2px solid var(--color-ring)` with `2px` offset

---

## Select Dropdowns

- Custom styled (not native on desktop)
- Chevron icon right-aligned
- Options: padding `12px`, hover `--color-muted`
- Mobile: native select is acceptable

---

## Validation

- Validate on blur (not on every keystroke)
- Error message: below input, `caption` size, `--color-destructive`
- Error border: `1px solid --color-destructive`
- Error icon: inline with message
- Success border: `1px solid --color-success`
- Error summary at top of form (role="alert")

---

## Buttons

### Footer
- Fixed bottom on mobile (with safe area padding)
- Sticky bottom on desktop
- Background: `--color-card` with top border
- Padding: `var(--space-4)`
- Gap between buttons: `var(--space-3)`

### Button Order (mobile, left to right)
1. Cancel (secondary)
2. Save Draft (secondary) — if applicable
3. Submit (primary)

---

## Helper Text

- Below input, `caption` size
- Color: `--color-muted-foreground`
- Examples, character counts, format hints

---

## Accessibility

- All fields have visible labels (not placeholder-only)
- Error messages linked via `aria-describedby`
- Focus moves to first error on submit failure
- Tab order follows visual order
- Screen reader announces errors via `role="alert"`

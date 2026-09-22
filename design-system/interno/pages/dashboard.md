# Dashboard — Page Overrides

Overrides MASTER.md for dashboard views (admin, coordinator, supervisor).

---

## Density

Dashboards are information-dense. Override spacing:

| Token | MASTER | Dashboard Override |
|-------|--------|-------------------|
| `--space-4` | `16px` | `12px` |
| `--space-6` | `24px` | `16px` |
| `--space-8` | `32px` | `24px` |

Cards are tighter. Stats tiles use `padding: 12px`. Tables use compact rows.

---

## Stats Cards

- Grid: 2 columns mobile, 4 columns desktop
- Card padding: `var(--space-3)` (12px)
- Stat number: `display-sm` weight `700`
- Stat label: `body-sm` color `--color-muted-foreground`
- Icon: 20px, color matches stat type (present=green, late=amber, absent=red)

---

## Data Tables

- Header: `--color-muted` background, `body-sm` weight `600`
- Rows: height `44px` minimum (touch target)
- Mobile: convert to card layout (stack rows vertically)
- Pagination: bottom, compact, with page numbers

---

## Charts

- Height: `200px` mobile, `300px` desktop
- Use Recharts (already installed)
- Chart colors: teal primary, amber accent, muted for inactive
- Tooltips: visible on hover/tap
- Legends: below chart, compact

---

## Quick Actions

- Grid: 3 columns mobile, 4 columns desktop
- Button style: ghost with icon + label
- Icon size: 20px
- Label: `body-sm` weight `500`
- Touch target: 44x44px minimum

---

## Navigation

### Desktop (lg+)
- Left sidebar, fixed width `256px`
- Collapsible to icon-only `64px`
- Active item: `--color-primary` background tint

### Mobile
- Bottom navigation bar (5 items max)
- Height: `56px` + safe area inset
- Active: `--color-primary` icon + label
- Inactive: `--color-muted-foreground`
- Touch target: 44x44px per tab

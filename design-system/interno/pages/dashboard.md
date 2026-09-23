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

## Stat Cards

Grid: 2 columns mobile, 4 columns desktop. Card padding: `var(--space-3)` (12px). Stat number: `display-sm` weight `700`. Stat label: `body-sm` color `muted-foreground`. Icon: 20px.

| Stat | Icon | Icon Color |
|------|------|------------|
| Total Trainees | `Users` | `primary` (teal) |
| Present Today | `Check` | `success` (green) |
| Late Today | `Clock` | `warning` (amber) |
| Absent Today | `X` | `destructive` (red) |
| Pending Approvals | `AlertCircle` | `accent` (amber) |
| OJT Progress | `BarChart` | `primary` (teal) |

---

## Data Tables

- Header: `--color-muted` background, `body-sm` weight `600`
- Rows: height `44px` minimum (touch target)
- Mobile: convert to card layout (stack rows vertically)
- Pagination: bottom, compact, with page numbers

---

## Chart Specs

Height: `200px` mobile, `300px` desktop. Library: Recharts. Tooltips visible on hover/tap. Legends below chart, compact. All color values reference design tokens — no raw hex in chart config.

| Dashboard | Chart | Type | Token Colors |
|-----------|-------|------|--------------|
| Admin | OJT Pipeline | Bar | `primary`, `secondary`, `muted` |
| Admin | Attendance | Bar | `success`, `warning`, `destructive` |
| Admin | Task Status | Pie | `primary`, `accent`, `success`, `muted` |
| Coordinator | OJT Pipeline | Bar | `primary`, `secondary`, `muted` |
| Coordinator | Attendance | Bar | `success`, `warning`, `destructive` |
| Supervisor | Pending DTR | Table | — |
| Supervisor | Assigned Trainees | Cards | — |

---

## Quick Actions

Grid: 3 columns mobile, 4 columns desktop. Button style: ghost with icon above label. Icon size: 20px. Label: `body-sm` weight `500`. Touch target: 44×44px minimum. All icons from Lucide React.

| Action | Icon | Token Color |
|--------|------|-------------|
| Generate QR | `QrCode` | `primary` |
| DTR Approvals | `FileCheck` | `accent` |
| View Trainees | `Users` | `primary` |
| Reports | `BarChart3` | `primary` |

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

# Interno Redesign Plan

> Hallmark brief: "Interno · trainee management system · dashboard redesign"
> Theme: Teal Flat (custom) · Genre: modern-minimal · Stack: React 18 + Vite + Tailwind v4

---

## Current State

### What exists
- **Tailwind v4** is installed (`tailwindcss@^4.3.3`, `@tailwindcss/postcss`) but the `@theme` block is now properly placed in `globals.css` — token mapping is complete.
- **`tokens.css`** — all colors in oklch, component tokens defined, dark mode `.dark` block present.
- **`globals.css`** — `@theme` maps all tokens to Tailwind utility names; `.btn`/`.input` classes removed; utilities `.truncate`, `.no-scrollbar`, `.line-clamp-2` added.
- **15 feature directories** exist under `src/features/` with 80+ components already wired to routes.
- **Landing page partially exists** — `src/features/auth/LandingPage.tsx` with `CTASection`, `FeaturesGrid`, `StatsSection`, `WhatsNewSection` — but it is **not registered in `App.tsx`** routing and uses raw color values.

### What needs to change
1. **`App.tsx` `PrivateLayout`** — hardcoded `bg-[#F5F5F5]`, `bg-white`, `border-[#D5D5D5]`, `text-[#121212]`, etc. throughout. Must use tokens.
2. **`TraineeDashboard` (inline in App.tsx)** — `bg-blue-50`, `text-blue-600`, `bg-green-50` etc. — all semantic color anti-patterns.
3. **All 23 admin components** — mix of hardcoded hex values and Tailwind semantic colors (`blue-600`, `gray-500`) that violate the anti-patterns list.
4. **All shared components** — `Modal.tsx`, `FormField.tsx`, `ConfirmDialog.tsx`, `AlertModal.tsx` are the foundation; must be token-clean first.
5. **Landing page** — exists in `src/features/auth/` but should move to `src/features/landing/`, adopt the new design system, and be wired to `/` route.
6. **No Tailwind config file** — Tailwind v4 is config-file-free; the `@theme` block in `globals.css` is the only configuration needed. ✓

### Inventory of components by phase

| Phase | Files | Count |
|-------|-------|-------|
| 1 | `tokens.css`, `globals.css` | 2 (done — verify only) |
| 2 | `Modal`, `FormField`, `ConfirmDialog`, `AlertModal`, `EmptyState`, `Toast`, `Skeleton` + `ui/*` | 12 |
| 3 | `AdminDashboard`, `AdminLayout`, `AdminOverview` | 3 |
| 4 | 8 list components | 8 |
| 5 | 8 form components | 8 |
| 6 | 4 coordinator components | 4 |
| 7 | 3 supervisor components | 3 |
| 8 | Tasks (4), DTR (2), Documents (4), Attendance (7), Announcements (3), Evaluations (4), Leave (3), Notifications (1), Reports (2), Auth (5) | 35 |
| 9 | Landing page (new) + `App.tsx` | 7 new + 2 modified |

---

## Phase 1: Tailwind v4 Integration

**Goal:** Confirm that `bg-primary`, `text-muted-foreground`, `border-border` and all other token utilities resolve correctly at build time. No code to write — verification only.

### Files to verify
- [`src/styles/tokens.css`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/styles/tokens.css) — source of truth for all custom property values
- [`src/styles/globals.css`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/styles/globals.css) — entry point with `@import 'tailwindcss'` and `@theme` block

### What to confirm in `globals.css`

The `@theme` block must declare every token that components will use as a Tailwind utility. Cross-check this list:

```
Colors:        bg-primary, bg-primary-hover, bg-primary-light, bg-on-primary
               bg-secondary, bg-accent, bg-accent-hover
               bg-destructive, bg-success, bg-warning, bg-info
               bg-background, bg-foreground, bg-card, bg-muted
               border-border, border-input, border-ring
               text-foreground, text-muted-foreground, text-primary,
               text-destructive, text-success, text-warning, text-info

Shadows:       shadow-sm, shadow-md, shadow-lg
Radius:        rounded-sm, rounded-md, rounded-lg, rounded-xl, rounded-full
Spacing:       All standard Tailwind steps (p-1 … p-16) are still present
Fonts:         font-display, font-body, font-mono
```

### Verification
- Run `npm run dev` — no Tailwind resolution errors in console
- Apply `className="bg-primary text-on-primary"` to a test element; inspect: it must render as `oklch(0.62 0.13 175)`
- Toggle `.dark` on `<html>`; `bg-background` must switch to `oklch(0.15 0.02 250)`
- Run `npm run build` — zero warnings about unknown utilities

---

## Phase 2: Shared Components

**Goal:** Establish the component foundation all features depend on. Every other phase imports from here.

### Files to change

#### [MODIFY] [`src/shared/components/Modal.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/Modal.tsx)
- Backdrop: replace any `rgba` or `bg-black/50` → `bg-foreground/50` (uses token)
- Container: `max-h-[85vh]`, `rounded-xl` (`--radius-xl`), `bg-card`, `border border-border`, `shadow-lg`
- Enter animation: `opacity-0 scale-95` → `opacity-100 scale-100`, duration `150ms`, `ease-out`
- Exit animation: reverse, duration `100ms`, `ease-out`
- Use Framer Motion `AnimatePresence` + `motion.div` (already installed)
- No hardcoded size classes — accept `size?: 'sm' | 'md' | 'lg'` prop mapping to `max-w-sm/md/lg`

#### [MODIFY] [`src/shared/components/FormField.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/FormField.tsx)
- Label: `text-sm font-medium text-foreground`, required `*` in `text-destructive`
- Input wrapper: `h-10 md:h-10` (pointer:coarse handled via CSS in globals)
- Input base: `w-full h-[--input-height] px-3 border border-input rounded-md bg-card text-foreground text-base focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors duration-[150ms]`
- Error state: add `border-destructive` class, show `<p role="alert" className="mt-1 text-xs text-destructive flex items-center gap-1">` with `AlertCircle` (16px)
- Success state: `border-success` + `CheckCircle` (16px) in `text-success`
- Helper text: `text-xs text-muted-foreground mt-1`
- Component Voice: error messages must name the field (pass `fieldName` prop to error formatter)

#### [MODIFY] [`src/shared/components/ConfirmDialog.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/ConfirmDialog.tsx)
- Wrap in updated `Modal` component
- Confirm button: use `variant="destructive"` from `ui/Button.tsx`
- Cancel button: use `variant="secondary"`
- Copy pattern: "Delete [entity]?" not "Are you sure you want to delete this item?"

#### [MODIFY] [`src/shared/components/AlertModal.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/AlertModal.tsx)
- Same modal shell; icon + color varies by `type: 'info' | 'success' | 'warning' | 'error'`
- Icon colors: `text-info`, `text-success`, `text-warning`, `text-destructive`

#### [MODIFY] [`src/shared/components/EmptyState.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/EmptyState.tsx)
- Component Voice: always provide `description` prop that tells user what to do next
- CTA button optional via `action?: { label: string; onClick: () => void }` prop
- Pattern: `text-muted-foreground` for icon, `text-foreground` for heading, `text-muted-foreground` for description

#### [MODIFY] [`src/shared/components/Toast.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/Toast.tsx)
- Enter: `translateY(100%) opacity-0` → `translateY(0) opacity-100`, `200ms ease-out`
- Exit: `translateX(0)` → `translateX(100%)`, `150ms ease-out`
- Variants: `success` (`bg-success`), `error` (`bg-destructive`), `warning` (`bg-warning`), `info` (`bg-info`)
- Note: `sonner` is installed — consider migrating to it instead of custom Toast (it respects `prefers-reduced-motion`)

#### [MODIFY] [`src/shared/components/Skeleton.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/Skeleton.tsx)
- Base: `bg-muted rounded-md animate-[skeleton-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]`
- The `skeleton-pulse` keyframe is already defined in `globals.css` — use it via `animation` utility

#### [MODIFY] [`src/shared/components/ui/Button.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/ui/Button.tsx)
- Height: `h-[--btn-height]` base, `@media (pointer: coarse) { h-[--btn-height-mobile] }` — or use `touch:h-[--btn-height-mobile]` pattern
- Variants:
  - `primary`: `bg-primary text-on-primary hover:bg-primary-hover`
  - `secondary`: `bg-transparent text-primary border border-primary hover:bg-primary-light`
  - `destructive`: `bg-destructive text-on-destructive hover:bg-destructive-hover`
  - `ghost`: `bg-transparent text-foreground hover:bg-muted`
  - `accent`: `bg-accent text-on-accent hover:bg-accent-hover`
- Active: `active:scale-[0.97]` transition `100ms ease-out`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`
- Loading: accept `isLoading` prop; show spinner, disable pointer events

#### [MODIFY] [`src/shared/components/ui/Card.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/ui/Card.tsx)
- Base: `bg-card border border-border rounded-lg text-card-foreground transition-[border-color,box-shadow] duration-200`
- Hover (pointer:fine only): `hover:border-primary` via `@media (hover: hover) and (pointer: fine)` — apply with CSS class, not Tailwind `hover:`

#### [MODIFY] [`src/shared/components/BottomNav.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/BottomNav.tsx)
- Container: `h-14 bg-card border-t border-border safe-area-inset-bottom`
- Active item: `text-primary`
- Inactive item: `text-muted-foreground`
- Each tab: `min-h-[44px] min-w-[44px]` touch target

#### [MODIFY] [`src/shared/components/ui/StatsGrid.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/shared/components/ui/StatsGrid.tsx)
- Grid: `grid grid-cols-2 md:grid-cols-4 gap-3`
- Each stat card: `bg-card border border-border rounded-lg p-3`
- Stat number: `text-[length:--text-display-sm] font-bold text-foreground`
- Stat label: `text-[length:--text-body-sm] text-muted-foreground`
- Icon: 20px, color via prop matching token name (`primary`, `success`, `warning`, `destructive`, `accent`)

### Verification
- Render `<Modal>`, `<FormField>`, `<Button>` in isolation — inspect token classes resolve
- Test error state in `<FormField>` with a required field — error text names field specifically
- Toggle dark mode — all components switch correctly
- Test on mobile viewport (375px) — touch targets are ≥ 44px
- `prefers-reduced-motion: reduce` — Modal/Toast animations disabled

---

## Phase 3: Admin Dashboard

**Goal:** Admin shell layout (sidebar + bottom nav) and overview page with stat cards and charts.

### Files to change

#### [MODIFY] [`src/features/admin/components/AdminLayout.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/AdminLayout.tsx)
- Desktop sidebar: `w-64 lg:w-16 (collapsed) bg-card border-r border-border fixed left-0 top-0 h-screen`
- Sidebar nav items: `h-[44px]` touch target, active `bg-primary-light text-primary`, inactive `text-muted-foreground hover:bg-muted`
- Collapsed sidebar (icon-only) at `lg:` — toggle state persisted in `localStorage` under key `interno:sidebar`
- Main content: `lg:pl-64 min-h-screen bg-background`
- Mobile: `BottomNav` visible below `lg:`; no sidebar shown
- Header (mobile): `h-14 bg-card border-b border-border sticky top-0 z-40` with logo + ThemeToggle

#### [MODIFY] [`src/features/admin/components/AdminDashboard.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/AdminDashboard.tsx)
- Remove inline `<TraineeDashboard>` pattern — delegate to `<AdminOverview />`
- Apply `<PageTransition>` wrapper
- Spacing: `p-4 md:p-6` content area padding

#### [MODIFY] [`src/features/admin/components/AdminOverview.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/AdminOverview.tsx)
- Stat cards: use `<StatsGrid>` with 6 stats from dashboard.md spec:
  - Total Trainees / `Users` / `text-primary`
  - Present Today / `Check` / `text-success`
  - Late Today / `Clock` / `text-warning`
  - Absent Today / `X` / `text-destructive`
  - Pending Approvals / `AlertCircle` / `text-accent`
  - OJT Progress / `BarChart` / `text-primary`
- Charts (Recharts, already installed):
  - OJT Pipeline: `BarChart` — `var(--color-primary)`, `var(--color-secondary)`, `var(--color-muted-foreground)` (pass as CSS variable strings)
  - Attendance: `BarChart` — `var(--color-success)`, `var(--color-warning)`, `var(--color-destructive)`
  - Task Status: `PieChart` — `var(--color-primary)`, `var(--color-accent)`, `var(--color-success)`, `var(--color-muted-foreground)`
- Chart container: `bg-card border border-border rounded-lg p-4`, height `h-[200px] md:h-[300px]`
- Quick Actions grid: `grid grid-cols-3 md:grid-cols-4 gap-3` using `<Button variant="ghost">` with icon above label
  - Generate QR / `QrCode` / primary
  - DTR Approvals / `FileCheck` / accent
  - View Trainees / `Users` / primary
  - Reports / `BarChart3` / primary
- Skeleton loading: show `<Skeleton>` for each stat card and chart while data loads

### Verification
- Desktop: sidebar at 256px, collapses to 64px on toggle, state persists on refresh
- Mobile (< 1024px): sidebar hidden, BottomNav visible
- Stat cards: 2-col mobile, 4-col desktop
- Charts render with correct token colors (inspect computed style)
- Quick Actions: each tappable area ≥ 44px

---

## Phase 4: Admin Lists (8 files)

**Goal:** All list/table views adopt the responsive table → card layout pattern from MASTER.md.

### Pattern to apply to all 8 files

**Desktop table:**
```tsx
<div className="bg-card border border-border rounded-lg overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-muted">
      <tr>
        <th className="h-[44px] px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">...</th>
      </tr>
    </thead>
    <tbody>
      <tr className="h-[44px] border-t border-border hover:bg-muted/50 transition-colors">
        <td className="px-3 text-sm text-foreground">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Mobile card layout (hidden at `md:`):**
```tsx
<div className="space-y-3 md:hidden">
  {items.map(item => (
    <div className="bg-card border border-border rounded-lg p-4">
      {/* stacked key-value pairs */}
    </div>
  ))}
</div>
<div className="hidden md:block">
  {/* table above */}
</div>
```

**Empty state:**
```tsx
<EmptyState
  title="No [entities] yet"
  description="Add one to get started."
  action={{ label: "Add [Entity]", onClick: openForm }}
/>
```

### Files to change

#### [MODIFY] [`src/features/admin/components/UserList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/UserList.tsx)
- Columns: Name, Email, Role (badge), Status, Actions
- Role badge: `rounded-full px-2 py-0.5 text-xs font-medium` + role color from MASTER.md (use token classes not raw hex)
- Actions: `<ActionsMenu>` with Edit / Deactivate / Delete — "Delete" not "Delete User"

#### [MODIFY] [`src/features/admin/components/CompanyList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/CompanyList.tsx)
- Columns: Company Name, Type (Internal/External), Trainees, Status, Actions
- Status badge: `text-success` (verified) / `text-warning` (pending) / `text-destructive` (rejected)

#### [MODIFY] [`src/features/admin/components/DepartmentList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/DepartmentList.tsx)
- Columns: Name, Code, Coordinator, Trainees, Actions

#### [MODIFY] [`src/features/admin/components/SupervisorList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/SupervisorList.tsx)
- Columns: Name, Email, Company, Type (Internal/External), Trainees assigned, Actions

#### [MODIFY] [`src/features/admin/components/CoordinatorList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/CoordinatorList.tsx)
- Columns: Name, Email, Department, Active Trainees, Actions

#### [MODIFY] [`src/features/admin/components/TraineeList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/TraineeList.tsx)
- Columns: Name, Student ID, Status (Internal/External), Company, Supervisor, OJT %, Actions
- OJT %: inline progress bar `bg-primary` on `bg-muted`, `4px` height

#### [MODIFY] [`src/features/admin/components/WorkScheduleList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/WorkScheduleList.tsx)
- Columns: Name, Days, Hours, Start Time, End Time, Actions

#### [MODIFY] [`src/features/admin/components/OJTScheduleList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/OJTScheduleList.tsx)
- Columns: Trainee, Required Hours, Completed Hours, Status, Actions

### Verification for all list files
- Mobile (375px): card layout visible, table hidden
- Desktop (1024px+): table visible, card layout hidden
- Every row is ≥ 44px height
- Empty state copy tells user what to do, not what is missing
- No `text-blue-600`, `text-gray-500`, or arbitrary values in JSX className strings

---

## Phase 5: Admin Forms (8 files)

**Goal:** All create/edit modals use the `FormField` component, token-correct inputs, and Component Voice copy.

### Pattern to apply to all 8 files

```tsx
// Modal shell
<Modal size="md" title="Add [Entity]" onClose={onClose}>
  <form onSubmit={handleSubmit} className="space-y-5 p-6">
    <FormField
      label="Field Label"
      fieldName="fieldName"
      error={errors.fieldName}
      required
    >
      <input className="input-base" ... />
    </FormField>

    {/* Footer */}
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
      <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" isLoading={isSubmitting}>Save</Button>
    </div>
  </form>
</Modal>
```

Button copy rules (Component Voice):
- Submit: "Save" not "Save Changes" / "Submit Form"
- Cancel: "Cancel" not "Go Back"
- Delete in ConfirmDialog: "Delete" not "Yes, delete this"

### Files to change

#### [MODIFY] [`src/features/admin/components/UserForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/UserForm.tsx)
- Fields: Display Name, Email, Role (select), Department (conditional), Password (create only)
- Validation messages: "Email is required", "Enter a valid email", "Password must be 8+ characters"

#### [MODIFY] [`src/features/admin/components/CompanyForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/CompanyForm.tsx)
- Fields: Company Name, Type, Address, Contact Person, Email, Phone
- Validation: "Company name is required", "Enter a valid email"

#### [MODIFY] [`src/features/admin/components/DepartmentForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/DepartmentForm.tsx)
- Fields: Department Name, Code, Coordinator (select)

#### [MODIFY] [`src/features/admin/components/SupervisorForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/SupervisorForm.tsx)
- Fields: Name, Email, Company (select), Type
- Validation: "Email is required", "Enter a valid email", "Company is required"

#### [MODIFY] [`src/features/admin/components/CoordinatorForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/CoordinatorForm.tsx)
- Fields: Name, Email, Department (select)

#### [MODIFY] [`src/features/admin/components/TraineeForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/TraineeForm.tsx)
- Multi-step form (3 steps): Personal Info → OJT Details → Document Requirements
- Step indicator: circles, Active `bg-primary`, Completed `bg-success` + Check icon, Pending `bg-muted`
- Navigation: Back (secondary, hidden on step 1) + Next (primary) / Save (primary on last step)

#### [MODIFY] [`src/features/admin/components/WorkScheduleForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/WorkScheduleForm.tsx)
- Fields: Schedule Name, Working Days (checkboxes), Time In, Time Out, Break Duration
- Day checkboxes: `44px` touch target each

#### [MODIFY] [`src/features/admin/components/OJTScheduleForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/OJTScheduleForm.tsx)
- Fields: Trainee (select), Required Hours, Start Date, Work Schedule (select)

### Verification for all form files
- All inputs: `h-[40px]`, `font-size: 16px` (no iOS zoom), `border-input`, focus ring `ring-ring`
- Error messages name the field: grep for "Field is required" — must be zero results
- Submit button: single word or short verb ("Save", "Add")
- Tab order follows visual layout
- Mobile: form is full-width with sticky footer

---

## Phase 6: Coordinator Dashboard

**Goal:** Coordinator-specific views styled with the same token system.

### Files to change

#### [MODIFY] [`src/features/coordinator/components/CoordinatorLayout.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/coordinator/components/CoordinatorLayout.tsx)
- Same sidebar/bottom-nav pattern as `AdminLayout`
- Sidebar items specific to coordinator role (Trainees, Assignments, Placements, Companies, Documents, Attendance, Tasks, Announcements, Evaluations)

#### [MODIFY] [`src/features/coordinator/components/CoordinatorDashboard.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/coordinator/components/CoordinatorDashboard.tsx)
- Stat cards (subset): Total Trainees, Present Today, Pending Approvals, OJT Progress
- Charts: OJT Pipeline (Bar, primary/secondary/muted), Attendance (Bar, success/warning/destructive)
- Quick Actions: Generate QR, DTR Approvals, View Trainees, Reports

#### [MODIFY] [`src/features/coordinator/components/CompanyVerification.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/coordinator/components/CompanyVerification.tsx)
- Status badges: Pending `bg-warning/10 text-warning`, Verified `bg-success/10 text-success`, Rejected `bg-destructive/10 text-destructive`
- Actions: "Verify" (primary), "Reject" (destructive) — not "Approve Company" / "Mark as Rejected"
- Empty state: "No companies pending verification."

#### [MODIFY] [`src/features/coordinator/components/PlacementRequestList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/coordinator/components/PlacementRequestList.tsx)
- Table columns: Trainee, Company, Requested, Status, Actions
- Mobile: card layout per request with trainee name prominent
- Empty state: "No placement requests yet. Trainees will appear here when they apply."

#### [MODIFY] [`src/features/coordinator/components/SupervisorInvite.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/coordinator/components/SupervisorInvite.tsx)
- Email input with validation: "Enter a valid email"
- Submit: "Send Invite" — not "Send Invitation Email"
- Success toast: "Invite sent" (via `sonner`)

### Verification
- Coordinator sees only department-scoped data (Firestore rules handle this; UI must not leak)
- All status badges use token colors, not raw values
- Empty states provide next-action guidance

---

## Phase 7: Supervisor Dashboard

**Goal:** Supervisor-specific views including QR display, DTR management, and trainee assignment.

### Files to change

#### [MODIFY] [`src/features/supervisor/components/SupervisorLayout.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/supervisor/components/SupervisorLayout.tsx)
- Same sidebar/bottom-nav shell; supervisor nav items: Dashboard, Trainees, QR, Attendance, DTR, Tasks, Evaluations, Leave, Announcements

#### [MODIFY] [`src/features/supervisor/components/SupervisorDashboard.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/supervisor/components/SupervisorDashboard.tsx)
- Pending DTR table: compact, `h-[44px]` rows, "Approve" (primary) / "Reject" (destructive) per row
- Assigned Trainees cards: 1-col mobile, 2-col desktop; `bg-card border border-border rounded-lg p-4`
- Empty state if no trainees: "No trainees assigned yet. Contact your coordinator."

#### [MODIFY] [`src/features/supervisor/components/SupervisorTraineeList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/supervisor/components/SupervisorTraineeList.tsx)
- Table → card layout responsive pattern (Phase 4 pattern)
- Columns: Name, Status (present/late/absent today), OJT %, Last Attendance, Actions

#### [MODIFY] [`src/features/attendance/components/SupervisorQRPage.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/attendance/components/SupervisorQRPage.tsx)
- Full `100dvh` layout, no scroll
- Viewfinder: `3px solid` `border-primary`, L-shaped corner accents in `text-primary`
- Bottom panel: `bg-card rounded-t-xl border-t border-border p-6 safe-area-inset-bottom`
- Status feedback (from qr-scanner.md):
  - Scanning: pulsing border
  - Success: green flash → `text-success`, checkmark
  - Error: red flash → `text-destructive`, shake
  - Offline: `bg-warning/10 text-warning` badge

#### [MODIFY] [`src/features/dtr/components/SupervisorDTRList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/dtr/components/SupervisorDTRList.tsx)
- Table: Trainee, Date Range, Total Hours, Status, Actions
- Bulk approve: primary button at top
- Mobile: card layout with trainee name + hours + status chip + inline approve/reject

#### [MODIFY] [`src/features/admin/components/SupervisorTraineeAssignment.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/admin/components/SupervisorTraineeAssignment.tsx)
- Drag-and-drop list (`@dnd-kit`, already installed) with `bg-card border border-border rounded-md` drag items
- Dragging state: `border-primary shadow-md`

### Verification
- QR page: full viewport, no overflow, bottom panel slides on mobile
- DTR table: bulk action accessible via keyboard
- Drag-and-drop: works with mouse and touch

---

## Phase 8: Other Features

**Goal:** Remaining 35 components adopt token classes consistently. No structural changes — token cleanup and Component Voice corrections.

### Sub-phase 8a: Attendance

#### [MODIFY] [`src/features/attendance/components/QRScanner.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/attendance/components/QRScanner.tsx)
- Full-screen layout per qr-scanner.md spec
- Viewfinder border: `border-primary`, corner accents
- Status states: success `text-success`, error `text-destructive`, offline `text-warning`

#### [MODIFY] [`src/features/attendance/components/TraineeAttendance.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/attendance/components/TraineeAttendance.tsx)
- Status chips: Present `bg-success/10 text-success`, Late `bg-warning/10 text-warning`, Absent `bg-destructive/10 text-destructive`

#### [MODIFY] [`src/features/attendance/components/AttendanceHistoryCalendar.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/attendance/components/AttendanceHistoryCalendar.tsx)
- Calendar days: Present `bg-success`, Late `bg-warning`, Absent `bg-destructive`, no-token colors removed

#### [MODIFY] [`src/features/attendance/components/SupervisorAttendanceMonitor.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/attendance/components/SupervisorAttendanceMonitor.tsx)
- Live list: card layout per trainee, status chip, last-scan timestamp in `text-muted-foreground`

### Sub-phase 8b: Tasks

#### [MODIFY] [`src/features/tasks/components/TaskList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/tasks/components/TaskList.tsx)
- Status chips: `bg-primary/10 text-primary` (assigned), `bg-warning/10 text-warning` (in-progress), `bg-success/10 text-success` (done)
- Priority chips: High `text-destructive`, Medium `text-warning`, Low `text-muted-foreground`
- Empty state: "No tasks assigned. Tasks you're given will appear here."

#### [MODIFY] [`src/features/tasks/components/TaskForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/tasks/components/TaskForm.tsx)
- Apply FormField pattern, Component Voice: "Save" not "Save Task"

#### [MODIFY] [`src/features/tasks/components/TaskDetail.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/tasks/components/TaskDetail.tsx)
- File attachment drop zone if applicable: `2px dashed border-border`, active `border-primary bg-primary-light`

#### [MODIFY] [`src/features/tasks/components/MyTasks.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/tasks/components/MyTasks.tsx)
- Same card/list pattern; drag-to-reorder via `@dnd-kit`

### Sub-phase 8c: DTR

#### [MODIFY] [`src/features/dtr/components/TraineeDTRView.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/dtr/components/TraineeDTRView.tsx)
- Table: Date, Time In, Time Out, Total Hours, Status
- Status chips same as attendance (approved/pending/rejected)
- Empty state: "No DTR records yet. Records appear after your first scan."

### Sub-phase 8d: Documents

#### [MODIFY] [`src/features/documents/components/DocumentList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/documents/components/DocumentList.tsx)
- Card layout: each document `bg-card border border-border rounded-lg p-4` with `FileText` icon, name, status chip, upload date

#### [MODIFY] [`src/features/documents/components/DocumentUploader.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/documents/components/DocumentUploader.tsx)
- Full File Upload spec from forms.md: drop zone states, file list rows, progress bar, per-file errors
- "PDF, DOCX, JPG — max 10 MB" helper text below drop zone

#### [MODIFY] [`src/features/documents/components/DocumentChecklist.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/documents/components/DocumentChecklist.tsx)
- Checklist items: `CheckCircle` `text-success` (submitted), `Circle` `text-muted-foreground` (pending)

### Sub-phase 8e: Evaluations, Announcements, Leave, Notifications, Reports

**Apply to each:**
- Token-only color classes — no `text-blue-600`, `text-gray-500`, raw hex
- Component Voice copy corrections
- Empty states with actionable descriptions

#### Files:
- [`src/features/evaluations/components/EvaluationList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/evaluations/components/EvaluationList.tsx) — status badges, card layout
- [`src/features/evaluations/components/EvaluationForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/evaluations/components/EvaluationForm.tsx) — FormField pattern, rating inputs
- [`src/features/evaluations/components/EvaluationReview.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/evaluations/components/EvaluationReview.tsx) — read-only card display
- [`src/features/evaluations/components/TraineeEvaluationView.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/evaluations/components/TraineeEvaluationView.tsx) — same
- [`src/features/announcements/components/AnnouncementList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/announcements/components/AnnouncementList.tsx) — card list, priority badge
- [`src/features/announcements/components/AnnouncementCard.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/announcements/components/AnnouncementCard.tsx) — `bg-card border border-border rounded-lg`
- [`src/features/announcements/components/AnnouncementForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/announcements/components/AnnouncementForm.tsx) — FormField pattern
- [`src/features/leave/components/LeaveForm.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/leave/components/LeaveForm.tsx) — FormField, date inputs, reason textarea
- [`src/features/leave/components/SupervisorLeaveList.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/leave/components/SupervisorLeaveList.tsx) — table, approve/reject actions
- [`src/features/leave/components/TraineeLeaveView.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/leave/components/TraineeLeaveView.tsx) — status cards
- [`src/features/notifications/components/NotificationCenter.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/notifications/components/NotificationCenter.tsx) — notification list, unread `bg-primary-light`, read `bg-card`
- [`src/features/reports/components/DashboardCharts.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/reports/components/DashboardCharts.tsx) — Recharts colors via CSS variables (no raw hex)
- [`src/features/reports/components/ReportGenerator.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/reports/components/ReportGenerator.tsx) — export buttons: "Export PDF" / "Export Excel"

### Sub-phase 8f: Auth pages

#### [MODIFY] [`src/features/auth/components/LoginPage.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/auth/components/LoginPage.tsx)
- Centered card: `max-w-sm mx-auto mt-16 bg-card border border-border rounded-xl p-8 shadow-md`
- Logo: `text-primary font-bold text-[length:--text-display-sm]`
- Input: FormField pattern
- Submit: `Button variant="primary" className="w-full"` — "Sign in" not "Login"
- Error: "Email or password is incorrect" not "Invalid credentials"

#### [MODIFY] [`src/features/auth/components/UnauthorizedPage.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/auth/components/UnauthorizedPage.tsx)
- EmptyState pattern: title "Access denied", description "You don't have permission to view this page. Contact your coordinator."

#### [MODIFY] [`src/features/auth/components/NotFoundPage.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/features/auth/components/NotFoundPage.tsx)
- EmptyState pattern with "Go home" CTA button

### Verification for Phase 8
- Run `grep -r "text-blue-\|text-gray-\|bg-blue-\|bg-gray-\|bg-green-\|bg-red-" src/features` — must return zero results
- Run `grep -r "#[0-9a-fA-F]\{3,6\}" src/features` — must return zero results
- All empty states pass Component Voice audit (tell user what to do)
- Document uploader: drag-drop works, 10MB limit enforced client-side, per-file errors shown

---

## Phase 9: Landing Page + Routing

**Goal:** Move the existing landing page to its own feature, complete it with the new design system, and register it on the `/` route.

### Files to change

#### [NEW] `src/features/landing/` directory
Structure:
```
src/features/landing/
├── LandingPage.tsx          ← root page component
├── components/
│   ├── HeroSection.tsx      ← NEW
│   ├── FeaturesGrid.tsx     ← move from auth/components/
│   ├── HowItWorks.tsx       ← NEW
│   ├── StatsSection.tsx     ← move from auth/components/
│   ├── CTASection.tsx       ← move from auth/components/
│   └── Footer.tsx           ← NEW
└── index.ts
```

#### [NEW] `src/features/landing/components/HeroSection.tsx`
- Full-width, `min-h-[80vh]`, `bg-background`
- Headline: `text-[length:--text-display-lg] font-bold text-foreground`
- Sub-headline: `text-[length:--text-body-lg] text-muted-foreground max-w-xl`
- CTA buttons: "Get Started" (primary, links to `/login`) + "Learn More" (secondary, anchors to Features)
- Background decoration: subtle teal gradient using `from-primary-light to-background` — no raw colors
- Mobile: single column, reduced headline size

#### [NEW] `src/features/landing/components/HowItWorks.tsx`
- 4-step horizontal flow (desktop) / vertical (mobile)
- Steps: Coordinator creates trainee → Assigns supervisor → Trainee scans QR → Coordinator reviews DTR
- Step circle: `bg-primary text-on-primary rounded-full w-10 h-10`
- Connector line: `bg-border h-0.5` (desktop) / `bg-border w-0.5` (mobile)

#### [NEW] `src/features/landing/components/Footer.tsx`
- `bg-card border-t border-border`
- Links: text-muted-foreground, hover `text-primary`
- Copyright: `text-xs text-muted-foreground`

#### [MODIFY] `src/features/landing/LandingPage.tsx` (moved from `src/features/auth/LandingPage.tsx`)
- Compose all 6 section components
- No raw colors anywhere — all via tokens
- `prefers-reduced-motion` respected in any scroll animations

#### [MODIFY] [`src/App.tsx`](file:///C:/Users/shawn/Documents/Default%20Project/trainee-management-system/src/App.tsx)
- Add `import { LandingPage } from '@/features/landing'`
- Change `<Route index element={<DashboardRedirect />} />` to:
  ```tsx
  <Route index element={<LandingPage />} />
  <Route path="/dashboard" element={<DashboardRedirect />} />
  ```
- Remove `TraineeDashboard` inline component from `App.tsx` — move to `src/features/trainee/components/TraineeDashboard.tsx`
- Fix `PrivateLayout`: replace all `bg-[#F5F5F5]`, `bg-white`, `border-[#D5D5D5]`, `text-[#121212]` with tokens

#### [MODIFY] `src/features/auth/LandingPage.tsx`
- Remove file (move contents to landing feature) or replace with a re-export to avoid breaking any stale imports

### Verification
- `/` route: landing page renders without auth
- `/dashboard` still redirects based on role
- Logged-in users navigating to `/` see landing page (or optionally redirect to their dashboard — note this in implementation)
- Landing page passes Lighthouse accessibility audit ≥ 90
- Mobile (375px): hero, features, CTA all render correctly

---

## Verification Checklist

### Token Compliance
- [ ] `grep -r "text-blue-\|bg-blue-\|text-gray-\|bg-gray-\|text-green-\|bg-red-" src/` returns zero results
- [ ] `grep -r "#[0-9a-fA-F]\{3,6\}" src/` returns zero results (excluding comments)
- [ ] `grep -r "rgba\|rgb(" src/` returns zero results
- [ ] `grep -r "oklch(" src/features` returns zero results (inline values forbidden)
- [ ] `grep -r "\[.*px\]" src/features` reviewed — no arbitrary pixel values except documented exceptions

### Component Voice
- [ ] `grep -r "Field is required\|Something went wrong\|Invalid input" src/` returns zero results
- [ ] `grep -rn "Save Changes\|Submit Form\|Delete Item" src/` returns zero results
- [ ] All empty states have an `action` prop or description ending in an action

### Layout
- [ ] All interactive elements ≥ 44px height on mobile (audit with DevTools device mode)
- [ ] All inputs have `font-size: 16px` minimum — no iOS zoom
- [ ] No `100vh` — only `100dvh`
- [ ] Sidebar at desktop, BottomNav at mobile (< 1024px) — verified in browser

### Animation
- [ ] Modal enter/exit timings match `150ms` / `100ms` spec
- [ ] Toast enter/exit timings match `200ms` / `150ms` spec
- [ ] `prefers-reduced-motion: reduce` disables all animations — verify in DevTools > Rendering

### Dark Mode
- [ ] Toggle `.dark` class on `<html>` — all surfaces switch (no hardcoded light colors remain)
- [ ] Charts use `var(--color-*)` strings — switch correctly in dark mode

### Build
- [ ] `npm run build` — zero warnings, zero errors
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint warnings

### Routing
- [ ] `/` → Landing page (no auth required)
- [ ] `/dashboard` → DashboardRedirect (role-based)
- [ ] `/login` → LoginPage
- [ ] `/admin/*`, `/supervisor/*`, `/coordinator/*`, `/trainee/*` — all protected, redirect to `/login` if unauthenticated

---

## Anti-Patterns to Avoid

| Pattern | Why | Fix |
|---------|-----|-----|
| `text-blue-600` | Not a design token | `text-primary` |
| `bg-gray-500` | Not a design token | `bg-muted-foreground` |
| `border-[#5EEAD4]` | Raw hex in JSX | `border-border` |
| `color: oklch(...)` inline style | Bypasses token system | `className="text-primary"` |
| `w-[372px]` | Arbitrary value | Use `max-w-sm/md/lg` or spacing token |
| `100vh` | Breaks on mobile browser chrome | `100dvh` |
| `:hover` without `@media (hover: hover)` | Sticky on touch | Use `globals.css` hover-gate classes |
| `"Field is required"` | Generic — violates Component Voice | `"Email is required"` |
| `"Save Changes"` | Verbose — violates Component Voice | `"Save"` |
| `"No items found"` | Apologetic empty state | `"Nothing here yet. Add one to get started."` |
| Animating `height`/`width`/`top` | Causes layout thrash | Animate `transform` + `opacity` only |
| `rgba(...)` in components | Inconsistent with oklch system | `oklch(x x x / alpha)` or token |
| Inline `style={{ color: '#...' }}` | Bypasses token system | className only |

---

## Implementation Order

Work strictly in phase order — each phase depends on the previous:

```
Phase 1 (verify) → Phase 2 (foundation) → Phase 3 (admin shell)
→ Phase 4 (lists) → Phase 5 (forms) → Phase 6 (coordinator)
→ Phase 7 (supervisor) → Phase 8 (other features) → Phase 9 (landing)
```

Phase 2 is the highest-leverage phase: fixing `Button`, `FormField`, `Modal`, and `EmptyState` propagates correct patterns to all 80+ components that import them.

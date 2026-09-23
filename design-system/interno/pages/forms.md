# Forms — Page Overrides

Overrides MASTER.md for form views (create/edit modals).

---

## Modal Container

- Desktop: centered, `max-w-lg` (512px), max `85vh` height
- Mobile: full viewport
- Animation: fade + scale 0.95 → 1 (150ms)
- Backdrop: `oklch(0 0 0 / 0.5)`

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

---

## Validation Messages

Validate on blur. Display inline below the field in `caption` size, `destructive` color with an inline icon. Success messages are optional — only show when the state is genuinely meaningful to the user.

Follow the Component Voice rule: name the field and the reason, never "Invalid input" or "Field is required".

| Field | Error Message | Success Message |
|-------|---------------|-----------------|
| Email | "Enter a valid email" | — |
| Password | "Password must be 8+ characters" | "Strong password" |
| Required | "[Field name] is required" | — |
| Min length | "[Field name] must be [n]+ characters" | — |
| Match | "Fields do not match" | "Matches" |

Rules:
- Replace `[Field name]` with the actual label, e.g. "Phone number is required"
- Never "This field is required" — always name it
- Error summary (`role="alert"`) at top of form lists all errors on submit failure
- Icon: `AlertCircle` (16px) inline before error text, `CheckCircle` (16px) for success

---

## Multi-Step Form

Used for: trainee onboarding, company registration, document submission. Step count shown in header. Progress does not advance until current step validates.

**Step indicator** — horizontal strip above form body.

| Step state | Background | Text | Icon |
|------------|------------|------|------|
| Active | `bg-primary` | `text-on-primary` (white) | Step number |
| Completed | `bg-success` | `text-on-primary` (white) | `Check` (16px) |
| Pending | `bg-muted` | `text-muted-foreground` | Step number |

Connector line between circles: `1px solid --color-border`. Completed connector: `1px solid --color-success`.

**Navigation footer** — same sticky footer as single-step forms.

| Button | Variant | Position | Condition |
|--------|---------|----------|-----------|
| Back | `secondary` | Left | Hidden on step 1 |
| Next | `primary` | Right | Hidden on last step |
| Submit | `primary` | Right | Last step only |

- Step labels: `body-sm` weight `500`, below circle, hidden on mobile if > 4 steps
- Tapping a completed step indicator navigates back (not forward)
- Keyboard: `Enter` advances, `Escape` cancels

---

## File Upload

Used for: document submission, profile photo, task attachments. Max 10MB per file enforced in both client and Cloud Function `validateUpload`.

**Drop zone**

| State | Border | Background | Text |
|-------|--------|------------|------|
| Default | `2px dashed --color-border` | `bg-muted` | "Drag files here or click to browse" |
| Active (drag over) | `2px dashed --color-primary` | `bg-primary-light` | "Drop to upload" |
| Disabled | `2px dashed --color-border` at `opacity-50` | — | — |

- Height: `120px` desktop, `80px` mobile
- Icon: `Upload` (24px), `text-muted-foreground`
- Click anywhere in zone opens native file picker

**File list** — each accepted file renders as a card row.

| Element | Spec |
|---------|------|
| Container | Card pattern: `bg-card`, `1px solid --color-border`, `radius-md` |
| File icon | `File` / `FileText` / `Image` (20px), `text-muted-foreground` |
| File name | `body-sm` weight `500`, truncate with ellipsis |
| File size | `caption`, `text-muted-foreground` |
| Remove button | `X` icon (16px), ghost, `text-destructive` on hover |
| Upload progress | Linear bar, `bg-primary`, full width, `4px` height |
| Success state | `CheckCircle` (16px), `text-success` replaces progress bar |
| Error state | `AlertCircle` (16px), `text-destructive`, error message below |

Rules:
- Accepted types shown as helper text below drop zone (e.g. "PDF, DOCX, JPG — max 10 MB")
- Multiple files: each row independent, errors per-file not per-batch
- Remove clears file from list immediately; server-side cleanup happens async

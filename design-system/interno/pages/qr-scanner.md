# QR Scanner — Page Overrides

Overrides MASTER.md for the QR attendance scanning view.

---

## Layout

- Full viewport height (`100dvh`)
- Camera viewfinder: centered, 280x280px on mobile, 320x320px on desktop
- Semi-transparent overlay around viewfinder
- Status bar: transparent (camera is the background)

---

## Viewfinder

- Border: 3px solid `--color-primary`
- Corner accents: `--color-primary`, 20px L-shapes
- Animated scan line: `--color-primary` with pulse animation
- Size: responsive, max `320px`

---

## Status Feedback

| State | Visual |
|-------|--------|
| Scanning | Pulsing border, "Point camera at QR code" |
| Success | Green flash + checkmark animation + haptic |
| Error | Red flash + shake animation + error message |
| Offline | Yellow badge + "Offline — will sync later" |

---

## Bottom Panel

- Background: `--color-card`
- Border radius: `var(--radius-xl)` top only
- Padding: `var(--space-6)`
- Contains: last scan info, manual entry button, help link

---

## Mobile-Specific

- Camera fills entire viewport
- No scroll — single screen
- Status bar blends with camera
- Bottom panel slides up over camera
- Haptic feedback on scan (if supported)

---

## Touch

- Tap viewfinder to focus
- No hover states (touch-only)
- Large tap target for manual entry button (44px height)

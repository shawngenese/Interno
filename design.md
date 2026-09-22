# Interno — Locked Design System

Genre: modern-minimal
Theme: Teal Flat (custom — based on ui-ux-pro-max MASTER.md)
Paper: light (#F0FDFA)
Accent: teal (#0D9488)
Display: geometric-sans (Fira Sans)
Body: geometric-sans (Fira Sans)
Mono: Fira Code

---

## Color Tokens

```css
:root {
  /* Primary */
  --color-primary: oklch(0.62 0.13 175);
  --color-primary-hover: oklch(0.55 0.13 175);
  --color-primary-light: oklch(0.95 0.04 175);
  --color-on-primary: oklch(1 0 0);

  /* Secondary */
  --color-secondary: oklch(0.82 0.12 175);
  --color-on-secondary: oklch(0.15 0.03 250);

  /* Accent */
  --color-accent: oklch(0.7 0.16 70);
  --color-accent-hover: oklch(0.6 0.16 70);
  --color-on-accent: oklch(1 0 0);

  /* Semantic */
  --color-destructive: oklch(0.58 0.22 30);
  --color-destructive-hover: oklch(0.5 0.22 30);
  --color-on-destructive: oklch(1 0 0);
  --color-success: oklch(0.63 0.19 155);
  --color-warning: oklch(0.7 0.16 70);
  --color-info: oklch(0.55 0.2 260);

  /* Surfaces — Light */
  --color-background: oklch(0.97 0.02 175);
  --color-foreground: oklch(0.22 0.05 175);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.22 0.05 175);
  --color-muted: oklch(0.94 0.02 200);
  --color-muted-foreground: oklch(0.45 0.02 250);
  --color-border: oklch(0.85 0.06 175);
  --color-input: oklch(0.75 0 0);
  --color-ring: oklch(0.62 0.13 175);
}

.dark {
  /* Surfaces — Dark */
  --color-background: oklch(0.15 0.02 250);
  --color-foreground: oklch(0.95 0.01 175);
  --color-card: oklch(0.2 0.02 250);
  --color-card-foreground: oklch(0.95 0.01 175);
  --color-muted: oklch(0.25 0.02 250);
  --color-muted-foreground: oklch(0.65 0.01 250);
  --color-border: oklch(0.3 0.02 250);
  --color-input: oklch(0.35 0 0);
  --color-ring: oklch(0.82 0.12 175);
}
```

## Typography

```css
:root {
  --font-display: 'Fira Sans', system-ui, -apple-system, sans-serif;
  --font-body: 'Fira Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', ui-monospace, monospace;

  --text-display-lg: 2.25rem;
  --text-display-md: 1.875rem;
  --text-display-sm: 1.5rem;
  --text-heading: 1.125rem;
  --text-body-lg: 1rem;
  --text-body: 0.875rem;
  --text-body-sm: 0.8125rem;
  --text-caption: 0.75rem;
  --text-mono: 0.875rem;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  --leading-tight: 1.2;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
}
```

## Spacing

```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

## Border Radius

```css
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

## Shadows

Flat design — minimal. Use borders for separation.

```css
:root {
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px oklch(0 0 0 / 0.07);
  --shadow-lg: 0 10px 15px oklch(0 0 0 / 0.1);
}
```

## Motion

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

---

## Rules

1. All tokens referenced by name — no inline hex/rgb/oklch in components
2. All headings roman — no italic headers
3. Mobile-first breakpoints: default → md: → lg: → xl:
4. Touch targets: 44x44px minimum
5. Input font size: 16px minimum (prevents iOS zoom)
6. `prefers-reduced-motion: reduce` — disable non-essential motion
7. Light/dark via `.dark` class on `<html>`

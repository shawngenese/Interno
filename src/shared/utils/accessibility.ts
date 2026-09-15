import { useEffect, useRef, useCallback } from 'react';

/** Trap focus within a container (for modals, dialogs). */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled]);
}

/** Manage focus when content changes (for route changes, dynamic content). */
export function useFocusOnMount(enabled = true): React.RefObject<HTMLElement> {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (enabled && ref.current) {
      ref.current.focus();
    }
  }, [enabled]);

  return ref;
}

/** Announce content to screen readers via live region. */
export function useAnnounce(): (message: string, priority?: 'polite' | 'assertive') => void {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', priority);
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => document.body.removeChild(el), 1000);
  }, []);

  return announce;
}

/** Get common ARIA props for interactive elements. */
export function getAriaProps(options: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  controls?: string;
  current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
}): Record<string, string | boolean | undefined> {
  const props: Record<string, string | boolean | undefined> = {};
  if (options.label) props['aria-label'] = options.label;
  if (options.labelledBy) props['aria-labelledby'] = options.labelledBy;
  if (options.describedBy) props['aria-describedby'] = options.describedBy;
  if (options.expanded !== undefined) props['aria-expanded'] = options.expanded;
  if (options.hasPopup) props['aria-haspopup'] = options.hasPopup;
  if (options.controls) props['aria-controls'] = options.controls;
  if (options.current !== undefined) props['aria-current'] = options.current;
  if (options.disabled) props['aria-disabled'] = true;
  if (options.required) props['aria-required'] = true;
  if (options.invalid) props['aria-invalid'] = true;
  return props;
}

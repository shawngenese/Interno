/**
 * Shared date/time formatting utilities.
 * All times display in 12-hour format (e.g., 2:30 PM) for PH locale.
 */

/** 12-hour time: "2:30 PM" */
export function formatTime12(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Date + time: "Sep 14, 2026, 2:30 PM" */
export function formatDateTime12(ms: number): string {
  return new Date(ms).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Short date only: "Sep 14, 2026" */
export function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Weekday + date: "Mon, Sep 14, 2026" */
export function formatDateFull(ms: number): string {
  return new Date(ms).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

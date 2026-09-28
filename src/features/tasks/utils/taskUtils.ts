import type { TaskStatus } from '../types';

/**
 * Parses an HTML date input string ('YYYY-MM-DD') to the end of that day (23:59:59.999 local time).
 */
export function parseDateInputToEndOfDay(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return new Date(dateStr).getTime();
  }
  const [year, month, day] = parts;
  const dateObj = new Date(year, month - 1, day, 23, 59, 59, 999);
  return dateObj.getTime();
}

/**
 * Formats a timestamp into a 'YYYY-MM-DD' string for HTML date inputs using local date.
 */
export function formatDueDateForInput(dueDate: number | Date | unknown): string {
  if (!dueDate) return '';
  let d: Date;
  if (typeof dueDate === 'number') {
    d = new Date(dueDate);
  } else if (dueDate instanceof Date) {
    d = dueDate;
  } else if (typeof dueDate === 'object' && dueDate !== null && 'toMillis' in dueDate) {
    d = new Date((dueDate as { toMillis: () => number }).toMillis());
  } else {
    return '';
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the effective due timestamp in milliseconds.
 * If the stored timestamp is at midnight (00:00:00 at the start of day),
 * it automatically extends it to 23:59:59.999 of that day.
 */
export function getTaskDueEndOfDay(dueDate: number | unknown): number {
  if (!dueDate) return Infinity;
  let ms: number;
  if (typeof dueDate === 'number') {
    ms = dueDate;
  } else if (dueDate instanceof Date) {
    ms = dueDate.getTime();
  } else if (typeof dueDate === 'object' && dueDate !== null && 'toMillis' in dueDate) {
    ms = (dueDate as { toMillis: () => number }).toMillis();
  } else {
    return Infinity;
  }

  const d = new Date(ms);
  // If the timestamp has 0 hours, 0 mins, 0 secs (start of day), treat as end of day 23:59:59.999
  if (
    (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) ||
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)
  ) {
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return endOfDay.getTime();
  }
  return ms;
}

/**
 * Checks if an active task is overdue.
 * Returns false if the task is already submitted, approved, completed, or archived.
 */
export function isTaskOverdue(dueDate: number | unknown, status: TaskStatus | string): boolean {
  if (status === 'approved' || status === 'completed' || status === 'submitted' || status === 'archived') {
    return false;
  }
  const dueMs = getTaskDueEndOfDay(dueDate);
  return Date.now() > dueMs;
}

/**
 * Checks if an active task is due soon (within 24 hours remaining until 11:59:59 PM of due date).
 */
export function isTaskDueSoon(dueDate: number | unknown, status: TaskStatus | string): boolean {
  if (status === 'approved' || status === 'completed' || status === 'submitted' || status === 'archived') {
    return false;
  }
  const dueMs = getTaskDueEndOfDay(dueDate);
  const msRemaining = dueMs - Date.now();
  return msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000;
}

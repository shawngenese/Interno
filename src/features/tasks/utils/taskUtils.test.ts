import { describe, it, expect } from 'vitest';
import {
  parseDateInputToEndOfDay,
  formatDueDateForInput,
  getTaskDueEndOfDay,
  isTaskOverdue,
  isTaskDueSoon,
} from './taskUtils';

describe('taskUtils', () => {
  it('parseDateInputToEndOfDay parses YYYY-MM-DD to end of local day (23:59:59.999)', () => {
    const ts = parseDateInputToEndOfDay('2026-09-28');
    const date = new Date(ts);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // September is 8 (0-indexed)
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
    expect(date.getMilliseconds()).toBe(999);
  });

  it('formatDueDateForInput formats local timestamp to YYYY-MM-DD', () => {
    const ts = parseDateInputToEndOfDay('2026-09-28');
    expect(formatDueDateForInput(ts)).toBe('2026-09-28');
  });

  it('getTaskDueEndOfDay extends midnight timestamps to 23:59:59.999 of that local day', () => {
    // If timestamp was stored as start of day
    const startOfDay = new Date(2026, 8, 28, 0, 0, 0, 0).getTime();
    const endOfDay = getTaskDueEndOfDay(startOfDay);
    const date = new Date(endOfDay);
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });

  it('isTaskOverdue returns false for tasks due today if current time is before 11:59:59 PM', () => {
    // Build the date string in LOCAL time — toISOString() is UTC, which is
    // yesterday between 00:00–08:00 in UTC+8 and made this test fail nightly.
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dueTodayEndOfDay = parseDateInputToEndOfDay(todayStr);

    expect(isTaskOverdue(dueTodayEndOfDay, 'pending')).toBe(false);
    expect(isTaskOverdue(dueTodayEndOfDay, 'in_progress')).toBe(false);
  });

  it('isTaskOverdue returns false for submitted, approved, completed or archived tasks', () => {
    const pastDueDate = Date.now() - 100000;
    expect(isTaskOverdue(pastDueDate, 'approved')).toBe(false);
    expect(isTaskOverdue(pastDueDate, 'submitted')).toBe(false);
    expect(isTaskOverdue(pastDueDate, 'archived')).toBe(false);
  });

  it('isTaskOverdue returns true for pending or in_progress tasks past due date', () => {
    const pastDueDate = Date.now() - 100000;
    expect(isTaskOverdue(pastDueDate, 'pending')).toBe(true);
    expect(isTaskOverdue(pastDueDate, 'in_progress')).toBe(true);
    expect(isTaskOverdue(pastDueDate, 'returned')).toBe(true);
  });

  it('isTaskDueSoon returns true if task is within 24 hours of due date', () => {
    const in12Hours = Date.now() + 12 * 60 * 60 * 1000;
    expect(isTaskDueSoon(in12Hours, 'pending')).toBe(true);
    expect(isTaskDueSoon(in12Hours, 'approved')).toBe(false);
  });
});

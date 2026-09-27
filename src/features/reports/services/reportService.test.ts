import { describe, it, expect } from 'vitest';
import {
  toMillis,
  generatePDFReport,
  generateExcelReport,
} from './reportService';

describe('reportService', () => {
  describe('toMillis', () => {
    it('handles numeric timestamps', () => {
      expect(toMillis(1700000000000)).toBe(1700000000000);
    });

    it('handles ISO string dates', () => {
      const date = new Date('2026-09-01T00:00:00Z');
      expect(toMillis('2026-09-01T00:00:00Z')).toBe(date.getTime());
    });

    it('handles Firestore Timestamp object with toMillis()', () => {
      const mockTimestamp = { toMillis: () => 1700000000000 };
      expect(toMillis(mockTimestamp)).toBe(1700000000000);
    });

    it('handles Firestore Timestamp object with toDate()', () => {
      const d = new Date(1700000000000);
      const mockTimestamp = { toDate: () => d };
      expect(toMillis(mockTimestamp)).toBe(1700000000000);
    });

    it('handles raw seconds and nanoseconds object', () => {
      const mockObj = { seconds: 1700000000, nanoseconds: 500000000 };
      expect(toMillis(mockObj)).toBe(1700000000500);
    });

    it('returns 0 for null or undefined', () => {
      expect(toMillis(null)).toBe(0);
      expect(toMillis(undefined)).toBe(0);
    });
  });

  describe('generatePDFReport', () => {
    it('generates a PDF Blob without crashing', () => {
      const headers = [['Header 1', 'Header 2', 'Header 3']];
      const data = [
        ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
        ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3'],
      ];

      const blob = generatePDFReport('Test PDF Report', headers, data);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe('application/pdf');
    });
  });

  describe('generateExcelReport', () => {
    it('generates an Excel Blob without crashing', () => {
      const sheets = [
        {
          name: 'TestSheet',
          headers: [['Col A', 'Col B']],
          data: [['Val 1', 'Val 2']],
        },
      ];

      const blob = generateExcelReport(sheets);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });
});

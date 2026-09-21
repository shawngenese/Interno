import { useState, useCallback, useEffect } from 'react';
import { generateAttendanceReport, generateDTRReport, generateTaskReport, generateDocumentReport, generateComprehensiveReport, downloadBlob, type ReportFilters } from '../services/reportService';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatDateTime12 } from '@/shared/utils/dateUtils';

type ReportType = 'attendance' | 'dtr' | 'tasks' | 'documents' | 'comprehensive';

interface ReportGeneratorProps {
  defaultCompanyId?: string;
}

export function ReportGenerator({ defaultCompanyId }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [filters, setFilters] = useState<ReportFilters>({
    companyId: defaultCompanyId || '',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getTime(),
  });
  const [generating, setGenerating] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'excel' | 'both'>('both');
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);

  // Load companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDocs(query(collection(db, 'companies'), where('status', '==', 'active')));
        setCompanies(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })));
      } catch (err) {
        console.error('Failed to load companies:', err);
      }
    }
    loadCompanies();
  }, []);

  // Load trainees when company changes
  useEffect(() => {
    async function loadTrainees() {
      if (!filters.companyId) {
        setTrainees([]);
        return;
      }
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDocs(
          query(collection(db, 'trainees'), where('companyId', '==', filters.companyId), where('status', '==', 'active')),
        );
        setTrainees(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })));
      } catch (err) {
        console.error('Failed to load trainees:', err);
      }
    }
    loadTrainees();
  }, [filters.companyId]);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFilters(f => ({ ...f, [field]: value ? new Date(value).getTime() : 0 }));
  };

  const handleCompanyChange = (companyId: string) => {
    setFilters(f => ({ ...f, companyId }));
  };

  const handleTraineeChange = (traineeId: string) => {
    setFilters(f => ({ ...f, traineeId }));
  };

  const generate = useCallback(async () => {
    if (!filters.companyId && reportType !== 'comprehensive') {
      setError('Company ID is required');
      return;
    }
    if (!filters.startDate || !filters.endDate) {
      setError('Start and end dates are required');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      let pdfBlob: Blob | null = null;
      let excelBlob: Blob | null = null;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseFilename = `${reportType}_report_${timestamp}`;

      switch (reportType) {
        case 'attendance': {
          const { pdf, excel } = await generateAttendanceReport(filters);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'dtr': {
          const { pdf, excel } = await generateDTRReport(filters);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'tasks': {
          const { pdf, excel } = await generateTaskReport(filters);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'documents': {
          const { pdf, excel } = await generateDocumentReport(filters);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'comprehensive': {
          const { pdf, excel } = await generateComprehensiveReport(filters);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
      }

      if (format === 'pdf' || format === 'both') {
        if (pdfBlob) downloadBlob(pdfBlob, `${baseFilename}.pdf`);
      }
      if (format === 'excel' || format === 'both') {
        if (excelBlob) downloadBlob(excelBlob, `${baseFilename}.xlsx`);
      }

      setLastGenerated(formatDateTime12(Date.now()));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [reportType, filters, format]);

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'attendance', label: 'Attendance', description: 'Time in/out records with late/undertime' },
    { value: 'dtr', label: 'DTR (Daily Time Record)', description: 'Calculated daily hours, OT, late, undertime' },
    { value: 'tasks', label: 'Tasks', description: 'Task assignments, status, priorities, due dates' },
    { value: 'documents', label: 'Documents', description: 'Uploaded documents with status and metadata' },
    { value: 'comprehensive', label: 'Comprehensive', description: 'All modules combined (Excel only for multi-sheet)' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-6">Report Generator</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label htmlFor="report-type" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Report Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {reportTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#757575] dark:text-[#9E9E9E]">
              {reportTypes.find(t => t.value === reportType)?.description}
            </p>
          </div>

          <div>
            <label htmlFor="format-pdf" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Output Format
            </label>
            <div className="flex gap-2">
              {['pdf', 'excel', 'both'].map(f => (
                <label key={f} className="flex items-center gap-1 cursor-pointer">
                  <input
                    id={`format-${f}`}
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel' | 'both')}
                    className="w-4 h-4 text-blue-600 border-[#BDBDBD] focus:ring-blue-500"
                  />
                  <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD] capitalize">{f}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="company-select" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Company
            </label>
            <select
              id="company-select"
              value={filters.companyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Company (required)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="report-start-date" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Start Date
            </label>
            <input
              id="report-start-date"
              type="date"
              value={filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="report-end-date" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              End Date
            </label>
            <input
              id="report-end-date"
              type="date"
              value={filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : ''}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="trainee-select" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Trainee (optional)
            </label>
            <select
              id="trainee-select"
              value={filters.traineeId || ''}
              onChange={(e) => handleTraineeChange(e.target.value)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
            >
              <option value="">All Trainees</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Status Filter (optional)
            </label>
            <input
              id="status-filter"
              type="text"
              value={filters.status || ''}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              placeholder="Filter by status"
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={generate}
            disabled={generating || !filters.companyId || !filters.startDate || !filters.endDate}
            className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Generate Report ({format.toUpperCase()})
              </>
            )}
          </button>

          {lastGenerated && (
            <span className="flex items-center text-sm text-[#757575] dark:text-[#9E9E9E]">
              Last generated: {lastGenerated}
            </span>
          )}

          <button
            onClick={() => window.print()}
            className="px-4 py-3 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#1E1E1E] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>

        <div className="mt-6 p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg text-sm text-[#555555] dark:text-[#9E9E9E]">
          <h4 className="font-medium text-[#121212] dark:text-white mb-2">Report Details</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Attendance:</strong> Raw time in/out scans with late/undertime calculations</li>
            <li><strong>DTR:</strong> Calculated daily hours including regular, overtime, late, undertime, night differential</li>
            <li><strong>Tasks:</strong> Task assignments, statuses, priorities, due dates, approval timestamps</li>
            <li><strong>Documents:</strong> Uploaded documents with type, status, file metadata</li>
            <li><strong>Comprehensive:</strong> All modules in one Excel workbook (multi-sheet) + summary PDF</li>
          </ul>
          <p className="mt-3 text-xs text-[#757575] dark:text-[#757575]">
            PDF: A4 landscape with auto-table, page numbers, date range header. Excel: multi-sheet with auto-column widths.
          </p>
        </div>
      </div>
    </div>
  );
}
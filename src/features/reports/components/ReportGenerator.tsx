import { useState, useCallback, useEffect } from 'react';
import { generateAttendanceReport, generateDTRReport, generateTaskReport, generateDocumentReport, generateComprehensiveReport, downloadBlob, type ReportFilters } from '../services/reportService';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { formatDateTime12 } from '@/shared/utils/dateUtils';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Download, Printer, AlertCircle } from 'lucide-react';

type ReportType = 'attendance' | 'dtr' | 'tasks' | 'documents' | 'comprehensive';

interface ReportGeneratorProps {
  defaultCompanyId?: string;
}

export function ReportGenerator({ defaultCompanyId }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [generating, setGenerating] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'excel' | 'both'>('both');
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [trainees, setTrainees] = useState<{ id: string; name: string }[]>([]);

  const {
    formData: filters,
    setFormData: setFilters,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useFormValidation<ReportFilters>(
    {
      companyId: defaultCompanyId || '',
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getTime(),
    },
    {
      companyId: [required('Company is required')],
      startDate: [required('Start date is required')],
      endDate: [required('End date is required')],
    },
  );

  // Load companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const db = getFirestoreInstancePublic();
        const snap = await getDocs(query(collection(db, 'companies'), orderBy('name')));
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
    setFilters((prev) => ({ ...prev, [field]: value ? new Date(value).getTime() : 0 }));
    handleBlur(field)();
  };

  const handleCompanyChange = useCallback(
    (value: string) => {
      handleChange('companyId')(value);
    },
    [handleChange],
  );

  const handleTraineeChange = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, traineeId: value }));
    },
    [setFilters],
  );

  const doGenerate = useCallback(async (data: ReportFilters) => {
    setGenerating(true);
    setError(null);

    try {
      let pdfBlob: Blob | null = null;
      let excelBlob: Blob | null = null;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseFilename = `${reportType}_report_${timestamp}`;

      switch (reportType) {
        case 'attendance': {
          const { pdf, excel } = await generateAttendanceReport(data);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'dtr': {
          const { pdf, excel } = await generateDTRReport(data);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'tasks': {
          const { pdf, excel } = await generateTaskReport(data);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'documents': {
          const { pdf, excel } = await generateDocumentReport(data);
          pdfBlob = pdf;
          excelBlob = excel;
          break;
        }
        case 'comprehensive': {
          const { pdf, excel } = await generateComprehensiveReport(data);
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
  }, [reportType, format]);

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'attendance', label: 'Attendance', description: 'Time in/out records with late/undertime' },
    { value: 'dtr', label: 'DTR (Daily Time Record)', description: 'Calculated daily hours, OT, late, undertime' },
    { value: 'tasks', label: 'Tasks', description: 'Task assignments, status, priorities, due dates' },
    { value: 'documents', label: 'Documents', description: 'Uploaded documents with status and metadata' },
    { value: 'comprehensive', label: 'Comprehensive', description: 'All modules combined (Excel multi-sheet + PDF)' },
  ];

  const startDateValue = filters.startDate ? new Date(filters.startDate).toISOString().split('T')[0] : '';
  const endDateValue = filters.endDate ? new Date(filters.endDate).toISOString().split('T')[0] : '';

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">Report Generator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Export structured PDF and Excel analytical reports</p>
        </div>

        <form
          onSubmit={handleSubmit(doGenerate)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="report-type" className="block text-xs font-semibold text-foreground mb-1.5">
                Report Type
              </label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {reportTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {reportTypes.find(t => t.value === reportType)?.description}
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-foreground mb-1.5">
                Output Format
              </span>
              <div className="flex gap-4 pt-2">
                {(['pdf', 'excel', 'both'] as const).map(f => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer">
                    <input
                      id={`format-${f}`}
                      type="radio"
                      name="format"
                      value={f}
                      checked={format === f}
                      onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel' | 'both')}
                      className="w-4 h-4 text-primary border-input focus:ring-primary"
                    />
                    <span className="text-xs font-medium text-foreground uppercase">{f}</span>
                  </label>
                ))}
              </div>
            </div>

            <FormField
              id="company-select"
              label="Company"
              required
              error={touched.companyId ? errors.companyId : undefined}
            >
              <FormSelect
                id="company-select"
                value={filters.companyId || ''}
                onValueChange={handleCompanyChange}
                onBlur={handleBlur('companyId')}
                error={touched.companyId ? errors.companyId : undefined}
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </FormSelect>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              id="report-start-date"
              label="Start Date"
              required
              error={touched.startDate ? errors.startDate : undefined}
            >
              <FormInput
                id="report-start-date"
                type="date"
                value={startDateValue}
                onValueChange={(value) => handleDateChange('startDate', value)}
                onBlur={handleBlur('startDate')}
                error={touched.startDate ? errors.startDate : undefined}
              />
            </FormField>

            <FormField
              id="report-end-date"
              label="End Date"
              required
              error={touched.endDate ? errors.endDate : undefined}
            >
              <FormInput
                id="report-end-date"
                type="date"
                value={endDateValue}
                onValueChange={(value) => handleDateChange('endDate', value)}
                onBlur={handleBlur('endDate')}
                error={touched.endDate ? errors.endDate : undefined}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField id="trainee-select" label="Trainee Scope (optional)">
              <FormSelect
                id="trainee-select"
                value={filters.traineeId || ''}
                onValueChange={handleTraineeChange}
              >
                <option value="">All Trainees in Company</option>
                {trainees.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </FormSelect>
            </FormField>

            <FormField id="status-filter" label="Status Filter (optional)">
              <FormInput
                id="status-filter"
                type="text"
                value={filters.status || ''}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                placeholder="Filter by specific status"
              />
            </FormField>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={generating}
            >
              <Download className="w-4 h-4 mr-2" />
              Generate Report ({format.toUpperCase()})
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print View
            </Button>

            {lastGenerated && (
              <span className="text-xs text-muted-foreground ml-auto">
                Last generated: {lastGenerated}
              </span>
            )}
          </div>
        </form>

        <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-border text-xs text-muted-foreground space-y-2">
          <h4 className="font-bold text-foreground text-sm">Report Capabilities</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Attendance:</strong> Full punch logs with late/undertime calculations and locations</li>
            <li><strong className="text-foreground">DTR:</strong> Official Daily Time Records with regular, OT, tardiness, and night differential</li>
            <li><strong className="text-foreground">Tasks:</strong> Assignments, progress, completion status, due dates, and supervisor review notes</li>
            <li><strong className="text-foreground">Documents:</strong> Compliance records, checklist approvals, upload dates, and review state</li>
            <li><strong className="text-foreground">Comprehensive:</strong> All modules bundled into a multi-sheet Excel workbook and summary PDF</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

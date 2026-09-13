import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportFilters {
  traineeId?: string;
  companyId?: string;
  departmentId?: string;
  supervisorId?: string;
  startDate: number;
  endDate: number;
  status?: string;
}

export interface AttendanceReportData {
  traineeId: string;
  traineeName: string;
  date: number;
  timestamp: number;
  timeIn?: number;
  timeOut?: number;
  status: string;
  lateMinutes: number;
  undertimeMinutes: number;
}

export interface DTRReportData {
  traineeId: string;
  traineeName: string;
  date: number;
  scheduledTimeIn: number;
  scheduledTimeOut: number;
  actualTimeIn?: number;
  actualTimeOut?: number;
  regularMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  nightDiffMinutes: number;
  status: string;
}

export interface TaskReportData {
  taskId: string;
  traineeId: string;
  traineeName: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: number;
  createdAt: number;
  approvedAt?: number;
}

export interface DocumentReportData {
  documentId: string;
  traineeId: string;
  traineeName: string;
  type: string;
  fileName: string;
  status: string;
  fileSize: number;
  uploadedAt: number;
}

/** Fetch attendance records for report. */
export async function getAttendanceReportData(filters: ReportFilters): Promise<AttendanceReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [
    where('timestamp', '>=', filters.startDate),
    where('timestamp', '<=', filters.endDate),
    orderBy('timestamp', 'asc'),
  ];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));

  const snap = await getDocs(query(collection(db, 'attendance_records'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as AttendanceReportData));
}

/** Fetch DTR entries for report. */
export async function getDTRReportData(filters: ReportFilters): Promise<DTRReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [
    where('date', '>=', filters.startDate),
    where('date', '<=', filters.endDate),
    orderBy('date', 'asc'),
  ];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const snap = await getDocs(query(collection(db, 'dtrs'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as DTRReportData));
}

/** Fetch tasks for report. */
export async function getTaskReportData(filters: ReportFilters): Promise<TaskReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [
    where('createdAt', '>=', filters.startDate),
    where('createdAt', '<=', filters.endDate),
    orderBy('createdAt', 'desc'),
  ];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const snap = await getDocs(query(collection(db, 'tasks'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TaskReportData));
}

/** Fetch documents for report. */
export async function getDocumentReportData(filters: ReportFilters): Promise<DocumentReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [
    where('createdAt', '>=', filters.startDate),
    where('createdAt', '<=', filters.endDate),
    orderBy('createdAt', 'desc'),
  ];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as DocumentReportData));
}

/** Generate PDF report using jsPDF + autoTable. */
export function generatePDFReport(
  title: string,
  headers: string[][],
  data: unknown[][],
  options: { orientation?: 'portrait' | 'landscape'; margins?: { top: number; right: number; bottom: number; left: number } } = {}
): Blob {
  const doc = new jsPDF({
    orientation: options.orientation || 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = options.margins || { top: 20, right: 10, bottom: 20, left: 10 };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, margin.top, { align: 'center' });

  // Date range
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, pageWidth - margin.right, margin.top, { align: 'right' });

  // Table
  (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
    head: headers,
    body: data,
    startY: margin.top + 10,
    margin: { left: margin.left, right: margin.right },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 20 }, // ID
    },
    didDrawPage: (opts: { pageNumber: number }) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${opts.pageNumber} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    },
  });

  return doc.output('blob');
}

/** Generate Excel report using SheetJS/xlsx. */
export function generateExcelReport(
  sheets: { name: string; headers: string[][]; data: any[][] }[],
): Blob {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, headers, data }) => {
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    // Auto-width columns
    const colWidths = headers[0].map((_, colIndex) => {
      const maxLen = Math.max(
        name.length,
        ...headers[0].map(h => h.length),
        ...data.map(row => (row[colIndex]?.toString()?.length || 0))
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Download blob as file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate attendance report (PDF + Excel). */
export async function generateAttendanceReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getAttendanceReportData(filters);

  const headers = [
    ['Trainee ID', 'Date', 'Time In', 'Time Out', 'Status', 'Late (min)', 'Undertime (min)'],
  ];
  const rows = data.map(d => [
    d.traineeId.slice(0, 8),
    new Date(d.timestamp).toLocaleDateString(),
    d.timeIn ? new Date(d.timeIn).toLocaleTimeString() : '—',
    d.timeOut ? new Date(d.timeOut).toLocaleTimeString() : '—',
    d.status || '—',
    d.lateMinutes || 0,
    d.undertimeMinutes || 0,
  ]);

  const pdf = generatePDFReport(`Attendance Report (${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()})`, headers, rows);
  const excel = generateExcelReport([{ name: 'Attendance', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate DTR report (PDF + Excel). */
export async function generateDTRReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getDTRReportData(filters);

  const headers = [
    ['Trainee ID', 'Date', 'Scheduled In', 'Scheduled Out', 'Actual In', 'Actual Out',
     'Regular (hrs)', 'OT (hrs)', 'Late (min)', 'Undertime (min)', 'Night Diff (hrs)', 'Status'],
  ];
  const rows = data.map(d => [
    d.traineeId.slice(0, 8),
    new Date(d.date).toLocaleDateString(),
    new Date(d.scheduledTimeIn).toLocaleTimeString(),
    new Date(d.scheduledTimeOut).toLocaleTimeString(),
    d.actualTimeIn ? new Date(d.actualTimeIn).toLocaleTimeString() : '—',
    d.actualTimeOut ? new Date(d.actualTimeOut).toLocaleTimeString() : '—',
    (d.regularMinutes / 60).toFixed(2),
    (d.overtimeMinutes / 60).toFixed(2),
    d.lateMinutes,
    d.undertimeMinutes,
    (d.nightDiffMinutes / 60).toFixed(2),
    d.status,
  ]);

  const pdf = generatePDFReport(`DTR Report (${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()})`, headers, rows);
  const excel = generateExcelReport([{ name: 'DTR', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate task report (PDF + Excel). */
export async function generateTaskReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getTaskReportData(filters);

  const headers = [
    ['Task ID', 'Trainee', 'Title', 'Status', 'Priority', 'Due Date', 'Created', 'Approved'],
  ];
  const rows = data.map(d => [
    d.taskId.slice(0, 8),
    d.traineeName || d.traineeId.slice(0, 8),
    d.title,
    d.status,
    d.priority,
    new Date(d.dueDate).toLocaleDateString(),
    new Date(d.createdAt).toLocaleDateString(),
    d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : '—',
  ]);

  const pdf = generatePDFReport(`Task Report (${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()})`, headers, rows);
  const excel = generateExcelReport([{ name: 'Tasks', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate document report (PDF + Excel). */
export async function generateDocumentReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getDocumentReportData(filters);

  const headers = [
    ['Document ID', 'Trainee', 'Type', 'File Name', 'Status', 'Size (KB)', 'Uploaded'],
  ];
  const rows = data.map(d => [
    d.documentId.slice(0, 8),
    d.traineeName || d.traineeId.slice(0, 8),
    d.type,
    d.fileName,
    d.status,
    (d.fileSize / 1024).toFixed(1),
    new Date(d.uploadedAt).toLocaleDateString(),
  ]);

  const pdf = generatePDFReport(`Document Report (${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()})`, headers, rows);
  const excel = generateExcelReport([{ name: 'Documents', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate comprehensive report (all modules). */
export async function generateComprehensiveReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const [attendance, dtrs, tasks, documents] = await Promise.all([
    getAttendanceReportData(filters),
    getDTRReportData(filters),
    getTaskReportData(filters),
    getDocumentReportData(filters),
  ]);

  const excelSheets = [
    { name: 'Attendance', headers: [['Trainee', 'Date', 'Time In', 'Time Out', 'Status', 'Late', 'Undertime']], data: attendance.map(d => [d.traineeId.slice(0,8), new Date(d.timestamp).toLocaleDateString(), d.timeIn?new Date(d.timeIn).toLocaleTimeString():'—', d.timeOut?new Date(d.timeOut).toLocaleTimeString():'—', d.status||'—', d.lateMinutes||0, d.undertimeMinutes||0]) },
    { name: 'DTR', headers: [['Trainee', 'Date', 'Sched In', 'Sched Out', 'Actual In', 'Actual Out', 'Reg (hrs)', 'OT (hrs)', 'Late', 'Undertime', 'Night Diff', 'Status']], data: dtrs.map(d => [d.traineeId.slice(0,8), new Date(d.date).toLocaleDateString(), new Date(d.scheduledTimeIn).toLocaleTimeString(), new Date(d.scheduledTimeOut).toLocaleTimeString(), d.actualTimeIn?new Date(d.actualTimeIn).toLocaleTimeString():'—', d.actualTimeOut?new Date(d.actualTimeOut).toLocaleTimeString():'—', (d.regularMinutes/60).toFixed(2), (d.overtimeMinutes/60).toFixed(2), d.lateMinutes, d.undertimeMinutes, (d.nightDiffMinutes/60).toFixed(2), d.status]) },
    { name: 'Tasks', headers: [['Task', 'Trainee', 'Title', 'Status', 'Priority', 'Due', 'Created', 'Approved']], data: tasks.map(d => [d.taskId.slice(0,8), d.traineeName||d.traineeId.slice(0,8), d.title, d.status, d.priority, new Date(d.dueDate).toLocaleDateString(), new Date(d.createdAt).toLocaleDateString(), d.approvedAt?new Date(d.approvedAt).toLocaleDateString():'—']) },
    { name: 'Documents', headers: [['Doc', 'Trainee', 'Type', 'File', 'Status', 'Size', 'Uploaded']], data: documents.map(d => [d.documentId.slice(0,8), d.traineeName||d.traineeId.slice(0,8), d.type, d.fileName, d.status, (d.fileSize/1024).toFixed(1), new Date(d.uploadedAt).toLocaleDateString()]) },
  ];

  const excel = generateExcelReport(excelSheets);

  // PDF: combine all into one multi-sheet PDF (simplified - first sheet only for PDF)
  const allHeaders = [
    ['Module', 'ID', 'Trainee', 'Date', 'Status', 'Details'],
  ];
  const allRows = [
    ...attendance.map(d => ['Attendance', d.traineeId.slice(0,8), '', new Date(d.timestamp).toLocaleDateString(), d.status||'—', `Late:${d.lateMinutes||0} UT:${d.undertimeMinutes||0}`]),
    ...dtrs.map(d => ['DTR', d.traineeId.slice(0,8), '', new Date(d.date).toLocaleDateString(), d.status, `Reg:${(d.regularMinutes/60).toFixed(2)} OT:${(d.overtimeMinutes/60).toFixed(2)}`]),
    ...tasks.map(d => ['Task', d.taskId.slice(0,8), d.traineeName||d.traineeId.slice(0,8), new Date(d.dueDate).toLocaleDateString(), d.status, `Priority:${d.priority}`]),
    ...documents.map(d => ['Document', d.documentId.slice(0,8), d.traineeName||d.traineeId.slice(0,8), new Date(d.uploadedAt).toLocaleDateString(), d.status, `Type:${d.type} ${(d.fileSize/1024).toFixed(1)}KB`]),
  ];

  const pdf = generatePDFReport(
    `Comprehensive Report (${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()})`,
    allHeaders,
    allRows
  );

  return { pdf, excel };
}
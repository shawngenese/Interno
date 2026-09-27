import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
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
  id: string;
  traineeId: string;
  traineeName: string;
  type?: 'time_in' | 'time_out';
  date: number;
  timestamp: number;
  timeIn?: number;
  timeOut?: number;
  status: string;
  lateMinutes: number;
  undertimeMinutes: number;
}

export interface DTRReportData {
  id: string;
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
  id: string;
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
  id: string;
  documentId: string;
  traineeId: string;
  traineeName: string;
  type: string;
  fileName: string;
  status: string;
  fileSize: number;
  uploadedAt: number;
  createdAt: number;
}

/** Helper to convert any timestamp format to epoch milliseconds. */
export function toMillis(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'object') {
    if (typeof (val as { toMillis?: () => number }).toMillis === 'function') {
      return (val as { toMillis: () => number }).toMillis();
    }
    if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    const obj = val as { seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number };
    const sec = obj.seconds ?? obj._seconds;
    if (typeof sec === 'number') {
      const nano = obj.nanoseconds ?? obj._nanoseconds ?? 0;
      return sec * 1000 + Math.floor(nano / 1000000);
    }
  }
  return 0;
}

/** Helper to resolve trainee IDs to display names from Firestore. */
async function resolveTraineeNames(
  traineeIds: string[],
): Promise<Record<string, string>> {
  if (traineeIds.length === 0) return {};
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, getDocs, query, where, documentId } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const nameMap: Record<string, string> = {};
  const uniqueIds = [...new Set(traineeIds.filter(Boolean))];
  const FIRESTORE_CHUNK_SIZE = 30;

  try {
    // 1. Fetch trainee docs to get userIds
    const traineeUserMap: Record<string, string> = {};
    for (let i = 0; i < uniqueIds.length; i += FIRESTORE_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + FIRESTORE_CHUNK_SIZE);
      const snap = await getDocs(query(collection(db, 'trainees'), where(documentId(), 'in', chunk)));
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          nameMap[doc.id] = data.name;
        }
        if (data.userId) {
          traineeUserMap[doc.id] = data.userId;
        }
      });
    }

    // 2. Fetch users for remaining unresolved names
    const unresolvedUserIds = Object.entries(traineeUserMap)
      .filter(([tId]) => !nameMap[tId])
      .map(([, uId]) => uId);

    if (unresolvedUserIds.length > 0) {
      const uniqueUserIds = [...new Set(unresolvedUserIds)];
      const userMap: Record<string, string> = {};

      for (let i = 0; i < uniqueUserIds.length; i += FIRESTORE_CHUNK_SIZE) {
        const chunk = uniqueUserIds.slice(i, i + FIRESTORE_CHUNK_SIZE);
        const userSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
        userSnap.docs.forEach((doc) => {
          const u = doc.data();
          userMap[doc.id] = u.displayName || u.name || u.email || 'Trainee';
        });
      }

      for (const [tId, uId] of Object.entries(traineeUserMap)) {
        if (!nameMap[tId] && userMap[uId]) {
          nameMap[tId] = userMap[uId];
        }
      }
    }

    // 3. Check if any remaining IDs match users directly (in case traineeId stores userId)
    const directUserIds = uniqueIds.filter((id) => !nameMap[id]);
    if (directUserIds.length > 0) {
      for (let i = 0; i < directUserIds.length; i += FIRESTORE_CHUNK_SIZE) {
        const chunk = directUserIds.slice(i, i + FIRESTORE_CHUNK_SIZE);
        const directUserSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
        directUserSnap.docs.forEach((doc) => {
          const u = doc.data();
          nameMap[doc.id] = u.displayName || u.name || u.email || 'Trainee';
        });
      }
    }
  } catch (err) {
    console.warn('Failed to resolve trainee names:', err);
  }

  return nameMap;
}

/** Helper to get all trainee IDs for a company. */
async function getCompanyTraineeIds(companyId: string): Promise<string[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  try {
    const snap = await getDocs(
      query(collection(db, 'trainees'), where('companyId', '==', companyId))
    );
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.warn('Failed to fetch trainees for company:', err);
    return [];
  }
}

/** Fetch attendance records for report. */
export async function getAttendanceReportData(filters: ReportFilters): Promise<AttendanceReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  let targetTraineeIds: string[] = [];
  if (filters.traineeId) {
    targetTraineeIds = [filters.traineeId];
  } else if (filters.companyId) {
    targetTraineeIds = await getCompanyTraineeIds(filters.companyId);
    if (targetTraineeIds.length === 0) return [];
  }

  const nameMap = await resolveTraineeNames(targetTraineeIds);
  const records: AttendanceReportData[] = [];
  const FIRESTORE_CHUNK_SIZE = 30;

  if (targetTraineeIds.length > 0) {
    for (let i = 0; i < targetTraineeIds.length; i += FIRESTORE_CHUNK_SIZE) {
      const chunk = targetTraineeIds.slice(i, i + FIRESTORE_CHUNK_SIZE);
      let docs: { id: string; data: () => Record<string, unknown> }[] = [];
      try {
        const snap = await getDocs(
          query(
            collection(db, 'attendance_records'),
            where('traineeId', 'in', chunk),
            where('timestamp', '>=', filters.startDate),
            where('timestamp', '<=', filters.endDate)
          )
        );
        docs = snap.docs;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('index')) {
          const fallbackSnap = await getDocs(
            query(collection(db, 'attendance_records'), where('traineeId', 'in', chunk))
          );
          docs = fallbackSnap.docs.filter((d) => {
            const raw = d.data();
            const ts = toMillis(raw.timestamp || raw.createdAt);
            return !ts || (ts >= filters.startDate && ts <= filters.endDate);
          });
        } else {
          throw err;
        }
      }

      docs.forEach((d) => {
        const raw = d.data();
        const ts = toMillis(raw.timestamp || raw.createdAt);
        const tId = (raw.traineeId as string) || '';
        records.push({
          id: d.id,
          traineeId: tId,
          traineeName: (raw.traineeName as string) || nameMap[tId] || 'Trainee',
          type: raw.type as 'time_in' | 'time_out',
          date: ts,
          timestamp: ts,
          timeIn: raw.type === 'time_in' ? ts : (raw.timeIn as number | undefined),
          timeOut: raw.type === 'time_out' ? ts : (raw.timeOut as number | undefined),
          status: (raw.status as string) || (raw.type === 'time_in' ? 'Timed In' : 'Timed Out'),
          lateMinutes: (raw.lateMinutes as number) || 0,
          undertimeMinutes: (raw.undertimeMinutes as number) || 0,
        });
      });
    }
  } else {
    // Admin query across all trainees within date range
    let docs: { id: string; data: () => Record<string, unknown> }[] = [];
    try {
      const snap = await getDocs(
        query(
          collection(db, 'attendance_records'),
          where('timestamp', '>=', filters.startDate),
          where('timestamp', '<=', filters.endDate)
        )
      );
      docs = snap.docs;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('index')) {
        const fallbackSnap = await getDocs(collection(db, 'attendance_records'));
        docs = fallbackSnap.docs.filter((d) => {
          const raw = d.data();
          const ts = toMillis(raw.timestamp || raw.createdAt);
          return !ts || (ts >= filters.startDate && ts <= filters.endDate);
        });
      } else {
        throw err;
      }
    }

    const traineeIdsInRecords = [...new Set(docs.map((d) => d.data().traineeId as string).filter(Boolean))];
    const resolvedNames = await resolveTraineeNames(traineeIdsInRecords);

    docs.forEach((d) => {
      const raw = d.data();
      const ts = toMillis(raw.timestamp || raw.createdAt);
      const tId = (raw.traineeId as string) || '';
      records.push({
        id: d.id,
        traineeId: tId,
        traineeName: (raw.traineeName as string) || resolvedNames[tId] || 'Trainee',
        type: raw.type as 'time_in' | 'time_out',
        date: ts,
        timestamp: ts,
        timeIn: raw.type === 'time_in' ? ts : (raw.timeIn as number | undefined),
        timeOut: raw.type === 'time_out' ? ts : (raw.timeOut as number | undefined),
        status: (raw.status as string) || (raw.type === 'time_in' ? 'Timed In' : 'Timed Out'),
        lateMinutes: (raw.lateMinutes as number) || 0,
        undertimeMinutes: (raw.undertimeMinutes as number) || 0,
      });
    });
  }

  // Sort ascending by timestamp
  return records.sort((a, b) => a.timestamp - b.timestamp);
}

/** Fetch DTR entries for report. */
export async function getDTRReportData(filters: ReportFilters): Promise<DTRReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  let rawList: Record<string, unknown>[] = [];
  try {
    const constraints = [
      where('date', '>=', filters.startDate),
      where('date', '<=', filters.endDate),
    ];
    if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
    if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
    if (filters.status) constraints.push(where('status', '==', filters.status));

    const snap = await getDocs(query(collection(db, 'dtrs'), ...constraints));
    rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('index')) {
      const fallbackConstraints = [];
      if (filters.traineeId) fallbackConstraints.push(where('traineeId', '==', filters.traineeId));
      else if (filters.companyId) fallbackConstraints.push(where('companyId', '==', filters.companyId));
      if (filters.status) fallbackConstraints.push(where('status', '==', filters.status));

      const snap = await getDocs(query(collection(db, 'dtrs'), ...fallbackConstraints));
      rawList = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
        .filter((d) => {
          const dDate = toMillis(d.date);
          return !dDate || (dDate >= filters.startDate && dDate <= filters.endDate);
        });
    } else {
      throw err;
    }
  }

  const traineeIds = [...new Set(rawList.map((d) => d.traineeId as string).filter(Boolean))];
  const nameMap = await resolveTraineeNames(traineeIds);

  const results: DTRReportData[] = rawList.map((d) => {
    const tId = (d.traineeId as string) || '';
    return {
      id: d.id as string,
      traineeId: tId,
      traineeName: (d.traineeName as string) || nameMap[tId] || 'Trainee',
      date: toMillis(d.date),
      scheduledTimeIn: toMillis(d.scheduledTimeIn),
      scheduledTimeOut: toMillis(d.scheduledTimeOut),
      actualTimeIn: d.actualTimeIn ? toMillis(d.actualTimeIn) : undefined,
      actualTimeOut: d.actualTimeOut ? toMillis(d.actualTimeOut) : undefined,
      regularMinutes: (d.regularMinutes as number) || 0,
      overtimeMinutes: (d.overtimeMinutes as number) || 0,
      lateMinutes: (d.lateMinutes as number) || 0,
      undertimeMinutes: (d.undertimeMinutes as number) || 0,
      nightDiffMinutes: (d.nightDiffMinutes as number) || 0,
      status: (d.status as string) || 'pending',
    };
  });

  return results.sort((a, b) => a.date - b.date);
}

/** Fetch tasks for report. */
export async function getTaskReportData(filters: ReportFilters): Promise<TaskReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const snap = await getDocs(query(collection(db, 'tasks'), ...constraints));
  const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  // Date filtering in memory to ensure type safety across number and Timestamp formats
  const filtered = rawList.filter((d) => {
    const created = toMillis(d.createdAt);
    if (!created) return true;
    return created >= filters.startDate && created <= filters.endDate;
  });

  const traineeIds = [...new Set(filtered.map((d) => d.traineeId as string).filter(Boolean))];
  const nameMap = await resolveTraineeNames(traineeIds);

  const results: TaskReportData[] = filtered.map((d) => {
    const tId = (d.traineeId as string) || '';
    return {
      id: d.id as string,
      taskId: d.id as string,
      traineeId: tId,
      traineeName: (d.traineeName as string) || nameMap[tId] || 'Trainee',
      title: (d.title as string) || 'Untitled Task',
      description: (d.description as string) || '',
      status: (d.status as string) || 'pending',
      priority: (d.priority as string) || 'medium',
      dueDate: toMillis(d.dueDate),
      createdAt: toMillis(d.createdAt),
      approvedAt: d.approvedAt ? toMillis(d.approvedAt) : undefined,
    };
  });

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

/** Fetch documents for report. */
export async function getDocumentReportData(filters: ReportFilters): Promise<DocumentReportData[]> {
  const { getFirestoreInstancePublic } = await import('@/config/firebase');
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const db = getFirestoreInstancePublic();

  const constraints = [];
  if (filters.traineeId) constraints.push(where('traineeId', '==', filters.traineeId));
  if (filters.companyId) constraints.push(where('companyId', '==', filters.companyId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const snap = await getDocs(query(collection(db, 'documents'), ...constraints));
  const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  const filtered = rawList.filter((d) => {
    const created = toMillis(d.createdAt || d.uploadedAt);
    if (!created) return true;
    return created >= filters.startDate && created <= filters.endDate;
  });

  const traineeIds = [...new Set(filtered.map((d) => d.traineeId as string).filter(Boolean))];
  const nameMap = await resolveTraineeNames(traineeIds);

  const results: DocumentReportData[] = filtered.map((d) => {
    const tId = (d.traineeId as string) || '';
    const ts = toMillis(d.uploadedAt || d.createdAt);
    return {
      id: d.id as string,
      documentId: d.id as string,
      traineeId: tId,
      traineeName: (d.traineeName as string) || nameMap[tId] || 'Trainee',
      type: (d.type as string) || 'other',
      fileName: (d.fileName as string) || 'Untitled Document',
      status: (d.status as string) || 'pending',
      fileSize: (d.fileSize as number) || 0,
      uploadedAt: ts,
      createdAt: toMillis(d.createdAt) || ts,
    };
  });

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

/** Generate PDF report using jsPDF + autoTable. */
export function generatePDFReport(
  title: string,
  headers: RowInput[],
  data: RowInput[],
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
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, margin.top, { align: 'center' });

  // Date range
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, pageWidth - margin.right, margin.top, { align: 'right' });

  // Table
  autoTable(doc, {
    head: headers,
    body: data,
    startY: margin.top + 10,
    margin: { left: margin.left, right: margin.right },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 25 },
    },
    didDrawPage: (opts: { pageNumber: number }) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${opts.pageNumber} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    },
  });

  return doc.output('blob');
}

/** Generate Excel report using SheetJS/xlsx. */
export function generateExcelReport(
  sheets: { name: string; headers: (string | number)[][]; data: (string | number | boolean | null | undefined)[][] }[],
): Blob {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ name, headers, data }) => {
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    const colWidths = (headers[0] || []).map((_, colIndex) => {
      const maxLen = Math.max(
        name.length,
        ...headers.map((h) => h[colIndex]?.toString()?.length || 0),
        ...data.map((row) => row[colIndex]?.toString()?.length || 0)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
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
    ['Trainee ID', 'Trainee Name', 'Date', 'Type / Status', 'Time', 'Late (min)', 'Undertime (min)'],
  ];
  const rows = data.map((d) => [
    (d.traineeId || '').slice(0, 8),
    d.traineeName || '—',
    d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '—',
    d.type ? (d.type === 'time_in' ? 'Time In' : 'Time Out') : d.status || '—',
    d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '—',
    d.lateMinutes || 0,
    d.undertimeMinutes || 0,
  ]);

  const dateRangeStr = `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
  const pdf = generatePDFReport(`Attendance Report (${dateRangeStr})`, headers, rows);
  const excel = generateExcelReport([{ name: 'Attendance', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate DTR report (PDF + Excel). */
export async function generateDTRReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getDTRReportData(filters);

  const headers = [
    [
      'Trainee ID',
      'Trainee Name',
      'Date',
      'Sched In',
      'Sched Out',
      'Actual In',
      'Actual Out',
      'Regular (hrs)',
      'OT (hrs)',
      'Late (min)',
      'Undertime (min)',
      'Night Diff (hrs)',
      'Status',
    ],
  ];
  const rows = data.map((d) => [
    (d.traineeId || '').slice(0, 8),
    d.traineeName || '—',
    d.date ? new Date(d.date).toLocaleDateString() : '—',
    d.scheduledTimeIn ? new Date(d.scheduledTimeIn).toLocaleTimeString() : '—',
    d.scheduledTimeOut ? new Date(d.scheduledTimeOut).toLocaleTimeString() : '—',
    d.actualTimeIn ? new Date(d.actualTimeIn).toLocaleTimeString() : '—',
    d.actualTimeOut ? new Date(d.actualTimeOut).toLocaleTimeString() : '—',
    ((d.regularMinutes || 0) / 60).toFixed(2),
    ((d.overtimeMinutes || 0) / 60).toFixed(2),
    d.lateMinutes || 0,
    d.undertimeMinutes || 0,
    ((d.nightDiffMinutes || 0) / 60).toFixed(2),
    d.status || 'pending',
  ]);

  const dateRangeStr = `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
  const pdf = generatePDFReport(`DTR Report (${dateRangeStr})`, headers, rows);
  const excel = generateExcelReport([{ name: 'DTR', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate task report (PDF + Excel). */
export async function generateTaskReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getTaskReportData(filters);

  const headers = [
    ['Task ID', 'Trainee Name', 'Title', 'Status', 'Priority', 'Due Date', 'Created', 'Approved'],
  ];
  const rows = data.map((d) => [
    (d.taskId || d.id || '').slice(0, 8),
    d.traineeName || '—',
    d.title || 'Untitled',
    d.status || 'pending',
    d.priority || 'medium',
    d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—',
    d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—',
    d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : '—',
  ]);

  const dateRangeStr = `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
  const pdf = generatePDFReport(`Task Report (${dateRangeStr})`, headers, rows);
  const excel = generateExcelReport([{ name: 'Tasks', headers, data: rows }]);

  return { pdf, excel };
}

/** Generate document report (PDF + Excel). */
export async function generateDocumentReport(filters: ReportFilters): Promise<{ pdf: Blob; excel: Blob }> {
  const data = await getDocumentReportData(filters);

  const headers = [
    ['Document ID', 'Trainee Name', 'Type', 'File Name', 'Status', 'Size (KB)', 'Uploaded'],
  ];
  const rows = data.map((d) => [
    (d.documentId || d.id || '').slice(0, 8),
    d.traineeName || '—',
    d.type || 'other',
    d.fileName || '—',
    d.status || 'pending',
    d.fileSize ? (d.fileSize / 1024).toFixed(1) : '0.0',
    d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—',
  ]);

  const dateRangeStr = `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
  const pdf = generatePDFReport(`Document Report (${dateRangeStr})`, headers, rows);
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
    {
      name: 'Attendance',
      headers: [['Trainee ID', 'Trainee Name', 'Date', 'Type / Status', 'Time', 'Late (min)', 'Undertime (min)']],
      data: attendance.map((d) => [
        (d.traineeId || '').slice(0, 8),
        d.traineeName || '—',
        d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '—',
        d.type ? (d.type === 'time_in' ? 'Time In' : 'Time Out') : d.status || '—',
        d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '—',
        d.lateMinutes || 0,
        d.undertimeMinutes || 0,
      ]),
    },
    {
      name: 'DTR',
      headers: [['Trainee ID', 'Trainee Name', 'Date', 'Sched In', 'Sched Out', 'Actual In', 'Actual Out', 'Reg (hrs)', 'OT (hrs)', 'Late', 'Undertime', 'Night Diff', 'Status']],
      data: dtrs.map((d) => [
        (d.traineeId || '').slice(0, 8),
        d.traineeName || '—',
        d.date ? new Date(d.date).toLocaleDateString() : '—',
        d.scheduledTimeIn ? new Date(d.scheduledTimeIn).toLocaleTimeString() : '—',
        d.scheduledTimeOut ? new Date(d.scheduledTimeOut).toLocaleTimeString() : '—',
        d.actualTimeIn ? new Date(d.actualTimeIn).toLocaleTimeString() : '—',
        d.actualTimeOut ? new Date(d.actualTimeOut).toLocaleTimeString() : '—',
        ((d.regularMinutes || 0) / 60).toFixed(2),
        ((d.overtimeMinutes || 0) / 60).toFixed(2),
        d.lateMinutes || 0,
        d.undertimeMinutes || 0,
        ((d.nightDiffMinutes || 0) / 60).toFixed(2),
        d.status || 'pending',
      ]),
    },
    {
      name: 'Tasks',
      headers: [['Task ID', 'Trainee Name', 'Title', 'Status', 'Priority', 'Due Date', 'Created', 'Approved']],
      data: tasks.map((d) => [
        (d.taskId || d.id || '').slice(0, 8),
        d.traineeName || '—',
        d.title || 'Untitled',
        d.status || 'pending',
        d.priority || 'medium',
        d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—',
        d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—',
        d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : '—',
      ]),
    },
    {
      name: 'Documents',
      headers: [['Doc ID', 'Trainee Name', 'Type', 'File Name', 'Status', 'Size (KB)', 'Uploaded']],
      data: documents.map((d) => [
        (d.documentId || d.id || '').slice(0, 8),
        d.traineeName || '—',
        d.type || 'other',
        d.fileName || '—',
        d.status || 'pending',
        d.fileSize ? (d.fileSize / 1024).toFixed(1) : '0.0',
        d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—',
      ]),
    },
  ];

  const excel = generateExcelReport(excelSheets);

  const allHeaders = [
    ['Module', 'Record ID', 'Trainee Name', 'Date', 'Status', 'Details'],
  ];
  const allRows = [
    ...attendance.map((d) => [
      'Attendance',
      (d.id || '').slice(0, 8),
      d.traineeName || '—',
      d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '—',
      d.type ? (d.type === 'time_in' ? 'Time In' : 'Time Out') : d.status || '—',
      `Late: ${d.lateMinutes || 0}m, Undertime: ${d.undertimeMinutes || 0}m`,
    ]),
    ...dtrs.map((d) => [
      'DTR',
      (d.id || '').slice(0, 8),
      d.traineeName || '—',
      d.date ? new Date(d.date).toLocaleDateString() : '—',
      d.status || 'pending',
      `Reg: ${((d.regularMinutes || 0) / 60).toFixed(1)}h, OT: ${((d.overtimeMinutes || 0) / 60).toFixed(1)}h`,
    ]),
    ...tasks.map((d) => [
      'Task',
      (d.taskId || d.id || '').slice(0, 8),
      d.traineeName || '—',
      d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—',
      d.status || 'pending',
      `Priority: ${d.priority} | ${d.title}`,
    ]),
    ...documents.map((d) => [
      'Document',
      (d.documentId || d.id || '').slice(0, 8),
      d.traineeName || '—',
      d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—',
      d.status || 'pending',
      `Type: ${d.type} (${(d.fileSize / 1024).toFixed(1)} KB)`,
    ]),
  ];

  const dateRangeStr = `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`;
  const pdf = generatePDFReport(
    `Comprehensive Report (${dateRangeStr})`,
    allHeaders,
    allRows
  );

  return { pdf, excel };
}
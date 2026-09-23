import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, type DocumentSnapshot, type QueryConstraint } from 'firebase/firestore';
import { downloadBlob } from '@/features/reports/services/reportService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { SkeletonCard } from '@/shared/components/Skeleton';

interface AuditLog {
  id: string;
  timestamp: number | { seconds: number; nanoseconds?: number; toDate?: () => Date } | { _seconds: number; _nanoseconds?: number } | null;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  originalValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  userName?: string;
  entityName?: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Login',
  logout: 'Logout',
  approve: 'Approved',
  reject: 'Rejected',
  scan: 'QR Scan',
  upload: 'Upload',
  role_change: 'Role Change',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'User',
  trainee: 'Trainee',
  task: 'Task',
  dtr: 'DTR',
  attendance: 'Attendance',
  document: 'Document',
  leave_request: 'Leave Request',
  qr_session: 'QR Session',
  correction_request: 'Correction Request',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  role: 'Role',
  status: 'Status',
  companyId: 'Company',
  departmentId: 'Department',
  supervisorId: 'Supervisor',
  coordinatorId: 'Coordinator',
  traineeId: 'Trainee',
  userId: 'User',
  title: 'Title',
  description: 'Description',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  endDate: 'End Date',
  startTime: 'Start Time',
  endTime: 'End Time',
  breakMinutes: 'Break Duration',
  reason: 'Reason',
  type: 'Type',
  entityType: 'Entity Type',
  entityName: 'Entity Name',
  action: 'Action',
  timestamp: 'Time',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  createdBy: 'Created By',
  notes: 'Notes',
  isApproved: 'Approved',
  attendanceDate: 'Attendance Date',
  loginTime: 'Login Time',
  logoutTime: 'Logout Time',
  ipAddress: 'IP Address',
  deviceInfo: 'Device',
  hoursWorked: 'Hours Worked',
  overtimeHours: 'Overtime Hours',
  totalHours: 'Total Hours',
  position: 'Position',
  address: 'Address',
  phone: 'Phone',
  emergencyContact: 'Emergency Contact',
  school: 'School',
  course: 'Course',
  yearLevel: 'Year Level',
  ojtHours: 'OJT Hours',
  completedHours: 'Completed Hours',
  remainingHours: 'Remaining Hours',
  placementStatus: 'Placement Status',
  placementCompany: 'Placement Company',
  companySize: 'Company Size',
  industry: 'Industry',
  contactPerson: 'Contact Person',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
  website: 'Website',
  logoUrl: 'Logo',
  documentType: 'Document Type',
  fileName: 'File Name',
  fileSize: 'File Size',
  fileUrl: 'File URL',
  qrCodeUrl: 'QR Code',
  taskStatus: 'Task Status',
  priority: 'Priority',
  estimatedMinutes: 'Estimated Time',
  actualMinutes: 'Actual Time',
  submissionNotes: 'Submission Notes',
  feedback: 'Feedback',
  grade: 'Grade',
 评分: 'Score',
};

function formatValue(value: unknown, nameCache?: Record<string, string>): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (nameCache && nameCache[value]) return nameCache[value];
    if (value.includes('T') && value.includes('Z')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-PH', { 
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true 
          });
        }
      } catch {
        // Invalid date string, fall through to raw value
      }
    }
    if (value.includes('@')) return value;
    if (value.startsWith('http')) return '[link]';
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '—';
    return keys.map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`).join(', ');
  }
  return String(value);
}

function formatFieldKey(key: string): string {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderChangeDescription(original: Record<string, unknown>, updated: Record<string, unknown>, nameCache?: Record<string, string>): React.ReactNode {
  const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);
  const changes: React.ReactNode[] = [];
  
  for (const key of allKeys) {
    const oldVal = original[key];
    const newVal = updated[key];
    
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
    
    changes.push(
      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 py-1.5 border-b border-border last:border-0">
        <span className="font-medium text-foreground min-w-30">{formatFieldKey(key)}</span>
        {oldVal !== undefined && newVal !== undefined ? (
          <>
            <span className="text-destructive line-through">{formatValue(oldVal, nameCache)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-success">{formatValue(newVal, nameCache)}</span>
          </>
        ) : oldVal !== undefined ? (
          <span className="text-destructive line-through">{formatValue(oldVal, nameCache)}</span>
        ) : (
          <span className="text-muted-foreground">{formatValue(newVal, nameCache)}</span>
        )}
      </div>
    );
  }
  
  return changes.length > 0 ? changes : <span className="text-muted-foreground">No changes</span>;
}

function renderMetadata(metadata: Record<string, unknown>, nameCache?: Record<string, unknown>): React.ReactNode {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  
  return Object.entries(metadata).map(([key, value]) => (
    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 py-1.5 border-b border-border last:border-0">
      <span className="font-medium text-foreground min-w-30">{formatFieldKey(key)}</span>
      <span className="text-muted-foreground">{formatValue(value, nameCache as Record<string, string>)}</span>
    </div>
  ));
}

function formatTimestamp(ts: number | { seconds: number; nanoseconds?: number; toDate?: () => Date } | { _seconds: number; _nanoseconds?: number } | null | undefined): string {
  if (ts == null) return '—';
  let ms: number;
  if (typeof ts === 'number') {
    ms = ts;
  } else if (typeof ts === 'object' && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    ms = (ts as { toDate: () => Date }).toDate().getTime();
  } else if (typeof ts === 'object') {
    const obj = ts as Record<string, unknown>;
    const seconds = (obj.seconds ?? obj._seconds) as number | undefined;
    const nanoseconds = (obj.nanoseconds ?? obj._nanoseconds) as number | undefined;
    if (typeof seconds === 'number') {
      ms = seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1_000_000);
    } else {
      return '—';
    }
  } else {
    return '—';
  }
  if (isNaN(ms)) return '—';
  return new Date(ms).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const ENTITY_COLLECTION_MAP: Record<string, string> = {
  user: 'users',
  company: 'companies',
  department: 'departments',
  supervisor: 'supervisors',
  trainee: 'trainees',
  work_schedule: 'work_schedules',
  ojt_schedule: 'ojt_schedules',
  task: 'tasks',
  document: 'documents',
  attendance_record: 'attendance_records',
  dtr: 'dtrs',
  qr_session: 'qr_sessions',
  correction_request: 'correction_requests',
  notification: 'notifications',
};

const ENTITY_NAME_FIELD: Record<string, string> = {
  user: 'displayName',
  company: 'name',
  department: 'name',
  supervisor: 'displayName',
  trainee: 'displayName',
  work_schedule: 'name',
  ojt_schedule: 'name',
  task: 'title',
  document: 'fileName',
  attendance_record: 'traineeName',
  dtr: 'traineeName',
  qr_session: 'traineeName',
  correction_request: 'traineeName',
  notification: 'title',
};

const TWO_STEP_ENTITIES = new Set(['supervisor', 'trainee']);

const PAGE_SIZE = 50;

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const requestIdRef = useRef(0);

  const fetchLogs = useCallback(async (reset = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const allRawLogs: AuditLog[] = [];
      let currentLastDoc: DocumentSnapshot | null = reset ? null : lastDoc;
      let keepFetching = true;

      const applyFilters = (logs: AuditLog[]): AuditLog[] => {
        return logs.filter((log) => {
          if (filters.action && log.action !== filters.action) return false;
          if (filters.entityType && log.entityType !== filters.entityType) return false;
          if (filters.startDate || filters.endDate) {
            const raw = log.timestamp;
            if (raw == null) return false;
            let ts: number;
            if (typeof raw === 'number') {
              ts = raw;
            } else if (typeof raw === 'object' && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
              ts = (raw as { toDate: () => Date }).toDate().getTime();
            } else if (typeof raw === 'object') {
              const obj = raw as Record<string, unknown>;
              const seconds = (obj.seconds ?? obj._seconds) as number | undefined;
              const nanoseconds = (obj.nanoseconds ?? obj._nanoseconds) as number | undefined;
              if (typeof seconds === 'number') {
                ts = seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1_000_000);
              } else {
                return false;
              }
            } else {
              return false;
            }
            if (isNaN(ts)) return false;
            if (filters.startDate && ts < new Date(filters.startDate).getTime()) return false;
            if (filters.endDate && ts > new Date(filters.endDate).getTime() + 86400000 - 1) return false;
          }
          return true;
        });
      };

      while (keepFetching) {
        const constraints: QueryConstraint[] = [
          orderBy('timestamp', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (currentLastDoc) {
          const { startAfter: startAfterFn } = await import('firebase/firestore');
          constraints.push(startAfterFn(currentLastDoc));
        }
        const snap = await getDocs(query(collection(db, 'audit_logs'), ...constraints));
        if (snap.empty) { keepFetching = false; break; }

        const batch = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
        allRawLogs.push(...batch);
        currentLastDoc = snap.docs[snap.docs.length - 1];

        const filtered = applyFilters(allRawLogs);

        if (filtered.length >= PAGE_SIZE || snap.docs.length < PAGE_SIZE) {
          keepFetching = false;
        }
      }

      const filteredLogs = applyFilters(allRawLogs);

      const resolvedLogs = await Promise.all(
        filteredLogs.map(async (log) => {
          const entityCollection = ENTITY_COLLECTION_MAP[log.entityType] || log.entityType;
          const nameField = ENTITY_NAME_FIELD[log.entityType] || 'name';
          const [userName, entityName] = await Promise.all([
            resolveDocName('users', log.userId, 'displayName'),
            (async () => {
              if (TWO_STEP_ENTITIES.has(log.entityType)) {
                try {
                  const entitySnap = await getDoc(doc(db, entityCollection, log.entityId));
                  if (entitySnap.exists()) {
                    const entityUserId = (entitySnap.data() as Record<string, unknown>).userId as string;
                    if (entityUserId) {
                      return resolveDocName('users', entityUserId, 'displayName').catch(() => '');
                    }
                  }
                } catch { /* fall through */ }
                return '';
              }
              return resolveDocName(entityCollection, log.entityId, nameField).catch(() => '');
            })(),
          ]);
          return { ...log, userName, entityName };
        }),
      );

      if (requestId !== requestIdRef.current) return;

      if (reset) {
        setLogs(resolvedLogs);
      } else {
        setLogs((prev) => [...prev, ...resolvedLogs]);
      }

      setLastDoc(currentLastDoc);
      setHasMore(allRawLogs.length >= PAGE_SIZE && (currentLastDoc ? true : false));
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, lastDoc]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!expandedLog) return;
    const log = logs.find((l) => l.id === expandedLog);
    if (!log) return;

    const allValues = { ...log.originalValue, ...log.newValue, ...log.metadata };
    const idsToResolve: string[] = [];

    for (const [, value] of Object.entries(allValues)) {
      if (typeof value === 'string' && value.length >= 10 && !value.includes(' ')) {
        if (!resolvedNames[value]) idsToResolve.push(value);
      }
    }

    if (idsToResolve.length === 0) return;

    let cancelled = false;
    const db = getFirestoreInstancePublic();

    Promise.all(
      idsToResolve.map(async (id) => {
        for (const collection of ['companies', 'departments', 'users']) {
          try {
            const snap = await getDoc(doc(db, collection, id));
            if (snap.exists()) {
              const data = snap.data() as Record<string, unknown>;
              const name = (data.name || data.displayName) as string | undefined;
              if (name) return { id, name };
            }
          } catch { /* continue */ }
        }

        for (const collection of ['supervisors', 'trainees', 'coordinators']) {
          try {
            const snap = await getDoc(doc(db, collection, id));
            if (snap.exists()) {
              const data = snap.data() as Record<string, unknown>;
              if (data.userId) {
                try {
                  const userSnap = await getDoc(doc(db, 'users', data.userId as string));
                  if (userSnap.exists()) {
                    const userData = userSnap.data() as Record<string, unknown>;
                    if (userData.displayName) return { id, name: userData.displayName as string };
                  }
                } catch { /* continue */ }
              }
              if (data.name) return { id, name: data.name as string };
            }
          } catch { /* continue */ }
        }

        return { id, name: id };
      })
    ).then((results) => {
      if (cancelled) return;
      setResolvedNames((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.id] = r.name;
        return next;
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedLog, logs]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `audit_log_${timestamp}`;

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.text('Audit Log Report', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 22);
      doc.text(`Total Records: ${logs.length}`, 14, 28);

      autoTable(doc, {
        startY: 32,
        head: [['Timestamp', 'Action', 'Entity', 'Entity Name', 'User', 'Metadata']],
        body: logs.map((log) => [
          formatTimestamp(log.timestamp),
          ACTION_LABELS[log.action] || log.action,
          ENTITY_LABELS[log.entityType] || log.entityType,
          log.entityName || '-',
          log.userName || '-',
          JSON.stringify(log.metadata || {}).slice(0, 50),
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      downloadBlob(doc.output('blob'), `${filename}.pdf`);
    } else {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(
        logs.map((log) => ({
          Timestamp: formatTimestamp(log.timestamp),
          Action: log.action,
          EntityType: log.entityType,
          EntityName: log.entityName || '-',
          UserName: log.userName || '-',
          Metadata: JSON.stringify(log.metadata || {}),
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Audit Logs</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('pdf')}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-on-destructive bg-destructive rounded-lg hover:bg-destructive-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-on-primary bg-primary rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          aria-label="Filter by action"
          className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          aria-label="Filter by entity type"
          className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        >
          <option value="">All Entities</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
          aria-label="Start date"
          className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
          aria-label="End date"
          className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({ action: '', entityType: '', startDate: '', endDate: '' })}
            className="px-3 py-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Log List */}
      {loading && logs.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                aria-label="Toggle details"
                aria-expanded={expandedLog === log.id}
                className="w-full px-4 py-3 min-h-[44px] text-left flex items-center justify-between hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    log.action === 'create' ? 'bg-success/15 text-success' :
                      log.action === 'update' ? 'bg-primary/10 text-primary' :
                    log.action === 'delete' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {ENTITY_LABELS[log.entityType] || log.entityType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.entityName || '—'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </span>
              </button>

              {expandedLog === log.id && (
                <div className="px-4 pb-3 border-t border-border">
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <div>
                        <span className="font-medium text-foreground">User</span>
                        <p className="text-muted-foreground">{log.userName || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      <div>
                        <span className="font-medium text-foreground">Entity</span>
                        <p className="text-muted-foreground">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                          {log.entityName && ` — ${log.entityName}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {log.originalValue && log.newValue && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                        <span className="font-medium text-foreground text-sm">Changes</span>
                      </div>
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        {renderChangeDescription(log.originalValue, log.newValue, resolvedNames)}
                      </div>
                    </div>
                  )}
                  
                  {log.originalValue && !log.newValue && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span className="font-medium text-foreground text-sm">Previous Values</span>
                      </div>
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        {renderMetadata(log.originalValue, resolvedNames)}
                      </div>
                    </div>
                  )}
                  
                  {log.newValue && !log.originalValue && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                        <span className="font-medium text-foreground text-sm">New Values</span>
                      </div>
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        {renderMetadata(log.newValue, resolvedNames)}
                      </div>
                    </div>
                  )}
                  
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <span className="font-medium text-foreground text-sm">Additional Details</span>
                      </div>
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        {renderMetadata(log.metadata, resolvedNames)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => fetchLogs(false)}
            className="px-6 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary-light dark:hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Load More
          </button>
        </div>
      )}

      {loading && logs.length > 0 && (
        <div className="text-center py-4 text-muted-foreground">Loading more...</div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { downloadBlob } from '@/features/reports/services/reportService';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { SkeletonCard } from '@/shared/components/Skeleton';
import { RefreshCw, Search, Download, X } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: unknown;
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
  dtr_approve: 'DTR Approved',
  dtr_reject: 'DTR Rejected',
  dtr_correct: 'DTR Corrected',
  scan: 'QR Scan',
  upload: 'Upload',
  document_upload: 'Document Upload',
  role_change: 'Role Change',
  verify: 'Company Verified',
  reject_company: 'Company Rejected',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'User',
  trainee: 'Trainee',
  supervisor: 'Supervisor',
  coordinator: 'Coordinator',
  company: 'Company',
  department: 'Department',
  task: 'Task',
  dtr: 'DTR',
  attendance: 'Attendance',
  attendance_record: 'Attendance Record',
  document: 'Document',
  leave_request: 'Leave Request',
  qr_session: 'QR Session',
  correction_request: 'Correction Request',
  notification: 'Notification',
  work_schedule: 'Work Schedule',
  ojt_schedule: 'OJT Schedule',
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
  score: 'Score',
};

export function parseTimestampToMs(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') {
    return raw < 1e11 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const parsed = new Date(raw).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) {
    return raw.getTime();
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof (raw as { toDate?: () => Date }).toDate === 'function') {
      try {
        return (raw as { toDate: () => Date }).toDate().getTime();
      } catch {
        // fallback
      }
    }
    const seconds = (obj.seconds ?? obj._seconds) as number | undefined;
    const nanoseconds = (obj.nanoseconds ?? obj._nanoseconds) as number | undefined;
    if (typeof seconds === 'number') {
      return seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1_000_000);
    }
  }
  return 0;
}

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
        // Invalid date string
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

function formatTimestamp(ts: unknown): string {
  const ms = parseTimestampToMs(ts);
  if (!ms || isNaN(ms)) return '—';
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
  coordinator: 'coordinators',
  trainee: 'trainees',
  work_schedule: 'work_schedules',
  ojt_schedule: 'ojt_schedules',
  task: 'tasks',
  document: 'documents',
  attendance: 'attendance_records',
  attendance_record: 'attendance_records',
  dtr: 'dtrs',
  qr_session: 'qr_sessions',
  correction_request: 'correction_requests',
  notification: 'notifications',
  leave_request: 'leave_requests',
};

const ENTITY_NAME_FIELD: Record<string, string> = {
  user: 'displayName',
  company: 'name',
  department: 'name',
  supervisor: 'displayName',
  coordinator: 'displayName',
  trainee: 'displayName',
  work_schedule: 'name',
  ojt_schedule: 'name',
  task: 'title',
  document: 'fileName',
  attendance: 'traineeName',
  attendance_record: 'traineeName',
  dtr: 'traineeName',
  qr_session: 'traineeName',
  correction_request: 'traineeName',
  notification: 'title',
  leave_request: 'reason',
};

const TWO_STEP_ENTITIES = new Set(['supervisor', 'trainee', 'coordinator']);
const PAGE_SIZE = 30;

export function AuditLogViewer() {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const requestIdRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      
      // Fetch up to 500 audit logs to guarantee full coverage of recent and historical logs
      const snap = await getDocs(query(collection(db, 'audit_logs'), limit(500)));
      if (requestId !== requestIdRef.current) return;

      const rawLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));

      // Strictly sort by parsed epoch ms descending (newest entries first)
      rawLogs.sort((a, b) => parseTimestampToMs(b.timestamp) - parseTimestampToMs(a.timestamp));

      // Resolve user and entity names for the logs
      const resolved = await Promise.all(
        rawLogs.map(async (log) => {
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
        })
      );

      if (requestId !== requestIdRef.current) return;

      setAllLogs(resolved);
      setPage(1);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Unique actions and entity types dynamically extracted from loaded logs
  const availableActions = useMemo(() => {
    const set = new Set<string>(Object.keys(ACTION_LABELS));
    for (const log of allLogs) {
      if (log.action) set.add(log.action);
    }
    return Array.from(set).sort();
  }, [allLogs]);

  const availableEntities = useMemo(() => {
    const set = new Set<string>(Object.keys(ENTITY_LABELS));
    for (const log of allLogs) {
      if (log.entityType) set.add(log.entityType);
    }
    return Array.from(set).sort();
  }, [allLogs]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allLogs.filter((log) => {
      // Action filter (handles aliases like approve/dtr_approve, upload/document_upload)
      if (filters.action) {
        if (filters.action === 'approve') {
          if (log.action !== 'approve' && log.action !== 'dtr_approve') return false;
        } else if (filters.action === 'reject') {
          if (log.action !== 'reject' && log.action !== 'dtr_reject' && log.action !== 'reject_company') return false;
        } else if (filters.action === 'upload') {
          if (log.action !== 'upload' && log.action !== 'document_upload') return false;
        } else if (log.action !== filters.action) {
          return false;
        }
      }

      // Entity filter (handles aliases like attendance/attendance_record)
      if (filters.entityType) {
        if (filters.entityType === 'attendance' || filters.entityType === 'attendance_record') {
          if (log.entityType !== 'attendance' && log.entityType !== 'attendance_record') return false;
        } else if (log.entityType !== filters.entityType) {
          return false;
        }
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        const ts = parseTimestampToMs(log.timestamp);
        if (!ts) return false;
        if (filters.startDate && ts < new Date(filters.startDate).getTime()) return false;
        if (filters.endDate && ts > new Date(filters.endDate).getTime() + 86400000 - 1) return false;
      }

      // Text search query
      if (q) {
        const userName = (log.userName || '').toLowerCase();
        const entityName = (log.entityName || '').toLowerCase();
        const entityType = (log.entityType || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const userId = (log.userId || '').toLowerCase();
        const entityId = (log.entityId || '').toLowerCase();
        const metadataStr = JSON.stringify(log.metadata || {}).toLowerCase();
        if (
          !userName.includes(q) &&
          !entityName.includes(q) &&
          !entityType.includes(q) &&
          !action.includes(q) &&
          !userId.includes(q) &&
          !entityId.includes(q) &&
          !metadataStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allLogs, filters, searchQuery]);

  const displayedLogs = useMemo(() => {
    return filteredLogs.slice(0, page * PAGE_SIZE);
  }, [filteredLogs, page]);

  const hasMore = displayedLogs.length < filteredLogs.length;

  // Quick date filters
  const setQuickDate = (preset: 'today' | '7days' | '30days' | 'all') => {
    if (preset === 'all') {
      setFilters((f) => ({ ...f, startDate: '', endDate: '' }));
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (preset === 'today') {
      setFilters((f) => ({ ...f, startDate: todayStr, endDate: todayStr }));
    } else if (preset === '7days') {
      const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      setFilters((f) => ({ ...f, startDate: past, endDate: todayStr }));
    } else if (preset === '30days') {
      const past = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      setFilters((f) => ({ ...f, startDate: past, endDate: todayStr }));
    }
  };

  // Resolve unknown UUID values when viewing log details
  useEffect(() => {
    if (!expandedLog) return;
    const log = displayedLogs.find((l) => l.id === expandedLog);
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
        for (const col of ['companies', 'departments', 'users']) {
          try {
            const snap = await getDoc(doc(db, col, id));
            if (snap.exists()) {
              const data = snap.data() as Record<string, unknown>;
              const name = (data.name || data.displayName) as string | undefined;
              if (name) return { id, name };
            }
          } catch { /* continue */ }
        }

        for (const col of ['supervisors', 'trainees', 'coordinators']) {
          try {
            const snap = await getDoc(doc(db, col, id));
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
    ).then((resolved) => {
      if (cancelled) return;
      setResolvedNames((prev) => {
        const next = { ...prev };
        for (const item of resolved) {
          next[item.id] = item.name;
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [expandedLog, displayedLogs, resolvedNames]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    const exportData = filteredLogs;
    if (exportData.length === 0) return;

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
      doc.text(`Total Records: ${exportData.length}`, 14, 28);

      autoTable(doc, {
        startY: 32,
        head: [['Timestamp', 'Action', 'Entity', 'Entity Name', 'User', 'Metadata']],
        body: exportData.map((log) => [
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
        exportData.map((log) => ({
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track, filter, and inspect all system security, compliance, and user activities</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-semibold text-muted-foreground bg-card border border-border rounded-xl hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-destructive rounded-xl hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Search & Filters Card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, entity, action, ID, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 min-h-[44px] bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Date Pickers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            aria-label="Filter by action"
            className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Actions ({availableActions.length})</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>
                {ACTION_LABELS[act] || act}
              </option>
            ))}
          </select>

          <select
            value={filters.entityType}
            onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
            aria-label="Filter by entity type"
            className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Entities ({availableEntities.length})</option>
            {availableEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ENTITY_LABELS[ent] || ent}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            aria-label="Start date"
            className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            aria-label="End date"
            className="px-3 py-2 min-h-[44px] border border-input rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Quick Date Shortcuts */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border">
            <button
              onClick={() => setQuickDate('today')}
              className="px-2.5 py-1 text-xs font-medium rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setQuickDate('7days')}
              className="px-2.5 py-1 text-xs font-medium rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              7 Days
            </button>
            <button
              onClick={() => setQuickDate('30days')}
              className="px-2.5 py-1 text-xs font-medium rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              30 Days
            </button>
          </div>

          {(filters.action || filters.entityType || filters.startDate || filters.endDate || searchQuery) && (
            <button
              onClick={() => {
                setFilters({ action: '', entityType: '', startDate: '', endDate: '' });
                setSearchQuery('');
              }}
              className="px-3 py-2 min-h-[44px] text-xs font-semibold text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-lg border border-border bg-card transition-colors"
            >
              Clear All Filters
            </button>
          )}

          <div className="text-xs text-muted-foreground self-center pl-1 sm:ml-auto">
            Showing log {displayedLogs.length} of {filteredLogs.length} logs
          </div>
        </div>
      </div>

      {/* Log List */}
      {loading && displayedLogs.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayedLogs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border text-muted-foreground text-sm">
          No audit logs found matching your selected filters.
        </div>
      ) : (
        <div className="space-y-2">
          {displayedLogs.map((log) => {
            const isExpanded = expandedLog === log.id;
            return (
              <div
                key={log.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full px-4 py-3 min-h-[44px] text-left flex items-center justify-between hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  {/* Left: Action + Entity */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 flex-1 text-left">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded shrink-0 ${
                      log.action === 'create' ? 'bg-success/15 text-success' :
                      log.action === 'update' ? 'bg-primary/10 text-primary' :
                      log.action === 'delete' ? 'bg-destructive/15 text-destructive' :
                      log.action.includes('approve') ? 'bg-success/15 text-success' :
                      log.action.includes('reject') ? 'bg-destructive/15 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {ENTITY_LABELS[log.entityType] || log.entityType}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {log.entityName || '—'}
                    </span>
                  </div>

                  {/* Right: Timestamp */}
                  <span className="text-xs font-medium text-muted-foreground shrink-0 ml-2 text-right">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </button>

                {expandedLog === log.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground text-xs uppercase tracking-wider">User / Initiator</span>
                          <p className="text-muted-foreground text-sm mt-0.5">{log.userName || log.userId || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Target Entity</span>
                          <p className="text-muted-foreground text-sm mt-0.5">
                            {ENTITY_LABELS[log.entityType] || log.entityType}
                            {log.entityName && ` (${log.entityName})`}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {log.originalValue && log.newValue && (
                      <div className="mt-3">
                        <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Changes</span>
                        <div className="mt-1.5 p-3 bg-card rounded-lg border border-border">
                          {renderChangeDescription(log.originalValue, log.newValue, resolvedNames)}
                        </div>
                      </div>
                    )}
                    
                    {log.originalValue && !log.newValue && (
                      <div className="mt-3">
                        <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Previous Values</span>
                        <div className="mt-1.5 p-3 bg-card rounded-lg border border-border">
                          {renderMetadata(log.originalValue, resolvedNames)}
                        </div>
                      </div>
                    )}
                    
                    {log.newValue && !log.originalValue && (
                      <div className="mt-3">
                        <span className="font-semibold text-foreground text-xs uppercase tracking-wider">New Values</span>
                        <div className="mt-1.5 p-3 bg-card rounded-lg border border-border">
                          {renderMetadata(log.newValue, resolvedNames)}
                        </div>
                      </div>
                    )}
                    
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3">
                        <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Additional Metadata</span>
                        <div className="mt-1.5 p-3 bg-card rounded-lg border border-border">
                          {renderMetadata(log.metadata, resolvedNames)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="text-center pt-2">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2.5 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring transition-colors cursor-pointer"
          >
            Load More Logs
          </button>
        </div>
      )}
    </div>
  );
}

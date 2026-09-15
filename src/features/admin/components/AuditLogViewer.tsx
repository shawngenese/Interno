import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, type DocumentSnapshot, type QueryConstraint } from 'firebase/firestore';
import { downloadBlob } from '@/features/reports/services/reportService';
import { formatDateTime12 } from '@/shared/utils/dateUtils';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { SkeletonCard } from '@/shared/components/Skeleton';

interface AuditLog {
  id: string;
  timestamp: number;
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

function formatTimestamp(ts: number | { seconds: number; nanoseconds: number }): string {
  const ms = typeof ts === 'number' ? ts : ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000);
  return formatDateTime12(ms);
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

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      let allRawLogs: AuditLog[] = [];
      let currentLastDoc: DocumentSnapshot | null = reset ? null : lastDoc;
      let keepFetching = true;

      // Keep fetching pages until we have enough filtered results or run out of data
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

        // Apply filters to accumulated logs
        const filtered = allRawLogs.filter((log) => {
          if (filters.action && log.action !== filters.action) return false;
          if (filters.entityType && log.entityType !== filters.entityType) return false;
          if (filters.startDate || filters.endDate) {
            const ts = typeof log.timestamp === 'number' ? log.timestamp : (log.timestamp as { seconds: number }).seconds * 1000;
            if (filters.startDate && ts < new Date(filters.startDate).getTime()) return false;
            if (filters.endDate && ts > new Date(filters.endDate).getTime() + 86400000 - 1) return false;
          }
          return true;
        });

        // Stop if we have enough filtered results or exhausted all data
        if (filtered.length >= PAGE_SIZE || snap.docs.length < PAGE_SIZE) {
          keepFetching = false;
        }
      }

      const filteredLogs = allRawLogs.filter((log) => {
        if (filters.action && log.action !== filters.action) return false;
        if (filters.entityType && log.entityType !== filters.entityType) return false;
        if (filters.startDate || filters.endDate) {
          const ts = typeof log.timestamp === 'number' ? log.timestamp : (log.timestamp as { seconds: number }).seconds * 1000;
          if (filters.startDate && ts < new Date(filters.startDate).getTime()) return false;
          if (filters.endDate && ts > new Date(filters.endDate).getTime() + 86400000 - 1) return false;
        }
        return true;
      });

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
  }, [filters]);

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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Logs</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('pdf')}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
          aria-label="End date"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({ action: '', entityType: '', startDate: '', endDate: '' })}
            className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
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
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No audit logs found</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <button
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                aria-label="Toggle details"
                aria-expanded={expandedLog === log.id}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    log.action === 'create' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    log.action === 'update' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    log.action === 'delete' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {ENTITY_LABELS[log.entityType] || log.entityType}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {log.entityName || '—'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(log.timestamp)}
                </span>
              </button>

              {expandedLog === log.id && (
                <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">User:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400 break-all">{log.userName || '—'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Entity:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400 break-all">{log.entityName || '—'}</span>
                    </div>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">Metadata:</span>
                      <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.originalValue && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">Original Value:</span>
                      <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(log.originalValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.newValue && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">New Value:</span>
                      <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(log.newValue, null, 2)}
                      </pre>
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
            className="px-6 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Load More
          </button>
        </div>
      )}

      {loading && logs.length > 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading more...</div>
      )}
    </div>
  );
}

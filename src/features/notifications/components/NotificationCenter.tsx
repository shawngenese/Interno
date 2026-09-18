import { useState, useEffect, useCallback } from 'react';
import { listNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, getNotificationPreferences, updateNotificationPreferences, getDefaultPreferences } from '../services/notificationService';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import type { Notification, NotificationType, NotificationPreferences, ListNotificationsParams } from '../types';

function formatTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function priorityBadge(priority: Notification['priority']): React.ReactNode {
  const styles: Record<Notification['priority'], string> = {
    low: 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD]',
    normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${styles[priority]}`}>{priority}</span>;
}

function typeIcon(type: NotificationType): React.ReactNode {
  const icons: Record<NotificationType, React.ReactNode> = {
    task_created: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    task_updated: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    task_due_soon: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    task_overdue: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    task_approved: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    task_returned: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    dtr_pending: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    dtr_approved: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    dtr_rejected: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    document_pending: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    document_approved: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    document_rejected: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    attendance_missing: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    qr_generated: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 16l-2-2m4 0l2-2m6-6H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>,
    leave_requested: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    leave_approved: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    leave_rejected: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    system_announcement: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 21l4.5-4.5" /></svg>,
    other: <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };
  return icons[type] || icons.other;
}

function priorityColor(priority: Notification['priority']): string {
  return priority === 'urgent' ? 'text-red-600 dark:text-red-400' :
         priority === 'high' ? 'text-orange-600 dark:text-orange-400' :
         priority === 'normal' ? 'text-blue-600 dark:text-blue-400' :
         'text-[#757575] dark:text-[#9E9E9E]';
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListNotificationsParams>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listNotifications(filters);
      setNotifications(result.data);
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPreferences = useCallback(async () => {
    const prefs = await getNotificationPreferences();
    setPreferences(prefs || getDefaultPreferences());
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [fetchNotifications, fetchPreferences]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(n => n.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(n => n.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      await deleteNotification(id);
      setNotifications(n => n.filter(n => n.id !== id));
      setTotal(t => t - 1);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: any) => {
    const newPrefs = { ...preferences!, [key]: value };
    setPreferences(newPrefs);
    try {
      await updateNotificationPreferences({ [key]: value });
    } catch (err) {
      console.error('Preference update failed:', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#121212] dark:text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Mark All Read
            </button>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="px-3 py-1.5 text-xs font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg"
            >
              Preferences
            </button>
          </div>
        </div>

        {showPreferences && preferences && (
          <div className="mb-6 p-4 bg-[#F5F5F5] dark:bg-[#1E1E1E]/50 rounded-lg space-y-4 border border-[#D5D5D5] dark:border-[#3A3A3A]">
            <h3 className="font-medium text-[#121212] dark:text-white">Notification Preferences</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.fcmEnabled}
                  onChange={e => handlePreferenceChange('fcmEnabled', e.target.checked)}
                  className="w-4 h-4 rounded border-[#BDBDBD] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">Push Notifications (FCM)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.inAppEnabled}
                  onChange={e => handlePreferenceChange('inAppEnabled', e.target.checked)}
                  className="w-4 h-4 rounded border-[#BDBDBD] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">In-App Notifications</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={e => handlePreferenceChange('emailEnabled', e.target.checked)}
                  className="w-4 h-4 rounded border-[#BDBDBD] text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">Email Notifications</span>
              </label>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F5F5] dark:bg-[#1E1E1E]/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Time</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] dark:text-[#9E9E9E] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5D5D5] dark:divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <svg className="animate-spin mx-auto h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState
                      icon={InboxIcon}
                      title="No notifications"
                      description="You're all caught up!"
                    />
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className={`hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A]/50 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={priorityColor(n.priority)}>{typeIcon(n.type)}</span>
                        <span className="font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">{n.type.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#121212] dark:text-white">{n.title}</td>
                    <td className="px-4 py-3 text-sm">{priorityBadge(n.priority)}</td>
                    <td className="px-4 py-3 text-sm text-[#757575] dark:text-[#9E9E9E]">{formatTime(n.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!n.read && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="px-3 py-1.5 text-xs font-medium text-[#555555] dark:text-[#9E9E9E] hover:text-red-600 dark:hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  disabled={(filters.page ?? 1) <= 1}
                  className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  disabled={(filters.page ?? 1) >= Math.ceil(total / (filters.limit || 20))}
                  className="px-3 py-1 text-sm border border-[#BDBDBD] dark:border-[#555555] rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
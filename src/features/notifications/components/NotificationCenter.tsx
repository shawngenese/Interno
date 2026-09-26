import { useState, useEffect, useCallback } from 'react';
import { listNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, getNotificationPreferences, updateNotificationPreferences, getDefaultPreferences } from '../services/notificationService';
import { EmptyState, InboxIcon } from '@/shared/components/EmptyState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { CheckCheck, Settings, Trash2, Bell, CheckCircle2, Clock, AlertTriangle, FileText, Calendar } from 'lucide-react';
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
    low: 'bg-muted text-muted-foreground border-border',
    normal: 'bg-primary/10 text-primary border-primary/20',
    high: 'bg-warning/10 text-warning border-warning/20',
    urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function typeIcon(type: NotificationType): React.ReactNode {
  switch (type) {
    case 'task_created':
    case 'task_updated':
    case 'task_approved':
      return <CheckCircle2 className="w-4 h-4 text-primary" />;
    case 'task_due_soon':
    case 'task_overdue':
    case 'attendance_missing':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    case 'task_returned':
    case 'dtr_rejected':
    case 'document_rejected':
    case 'leave_rejected':
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case 'dtr_pending':
    case 'dtr_approved':
      return <Clock className="w-4 h-4 text-primary" />;
    case 'document_pending':
    case 'document_approved':
      return <FileText className="w-4 h-4 text-primary" />;
    case 'leave_requested':
    case 'leave_approved':
      return <Calendar className="w-4 h-4 text-primary" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListNotificationsParams>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listNotifications(filters);
      setNotifications(result.data);
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPreferences = useCallback(async () => {
    try {
      const prefs = await getNotificationPreferences();
      setPreferences(prefs || getDefaultPreferences());
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
      setPreferences(getDefaultPreferences());
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [fetchNotifications, fetchPreferences]);

  const handleMarkRead = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.read) return;
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: 'Delete Notification',
      message: 'Are you sure you want to delete this notification?',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteNotification(id);
          setNotifications(prev => prev.filter(n => n.id !== id));
          setTotal(t => t - 1);
        } catch (err) {
          console.error('Delete failed:', err);
        }
      },
    });
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await updateNotificationPreferences({ [key]: value });
    } catch (err) {
      console.error('Preference update failed:', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  return (
    <>
      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Notifications</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Stay updated with activity alerts, tasks, and system events</p>
              </div>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/20 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                variant="secondary"
                size="sm"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark All Read
              </Button>
              <Button
                onClick={() => setShowPreferences(!showPreferences)}
                variant={showPreferences ? 'primary' : 'secondary'}
                size="sm"
              >
                <Settings className="w-3.5 h-3.5 mr-1" />
                Preferences
              </Button>
            </div>
          </div>

          {showPreferences && preferences && (
            <div className="mb-6 p-4 bg-muted/40 rounded-xl space-y-3 border border-border">
              <h3 className="font-bold text-foreground text-sm">Notification Channels</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.fcmEnabled}
                    onChange={e => handlePreferenceChange('fcmEnabled', e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium text-foreground">Push Notifications (FCM)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.inAppEnabled}
                    onChange={e => handlePreferenceChange('inAppEnabled', e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium text-foreground">In-App Notifications</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={e => handlePreferenceChange('emailEnabled', e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium text-foreground">Email Notifications</span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => { setError(null); fetchNotifications(); }}>Retry</Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="rectangular" height={56} className="rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No notifications"
              description="You're all caught up! New alerts will appear here."
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="space-y-3 md:hidden">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border transition-all ${
                      !n.read
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {typeIcon(n.type)}
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {n.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {priorityBadge(n.priority)}
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">{n.title}</p>
                    <p className="text-xs text-muted-foreground mb-3">{formatTime(n.createdAt)}</p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      {!n.read && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          Mark Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(n.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                      <th className="h-[44px] px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                      <th className="h-[44px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {notifications.map((n) => (
                      <tr
                        key={n.id}
                        className={`h-[44px] transition-colors hover:bg-muted/40 ${
                          !n.read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-2">
                            {typeIcon(n.type)}
                            <span className="font-semibold text-foreground capitalize">{n.type.replace(/_/g, ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{n.title}</td>
                        <td className="px-4 py-3">{priorityBadge(n.priority)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatTime(n.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!n.read && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleMarkRead(n.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(n.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <p>
                    Showing {((filters.page ?? 1) - 1) * (filters.limit || 20) + 1} to {Math.min((filters.page ?? 1) * (filters.limit || 20), total)} of {total} notifications
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                      disabled={(filters.page || 1) <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                      disabled={(filters.page || 1) >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}
import { announcementService } from '../services/announcementService';
import { ANNOUNCEMENT_PRIORITY_LABELS, ANNOUNCEMENT_STATUS_LABELS, ROLE_LABELS } from '../types';
import type { Announcement } from '../types';
import { Pin, Send, Archive, Edit2, Trash2 } from 'lucide-react';

interface AnnouncementCardProps {
  announcement: Announcement;
  showActions?: boolean;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
}

export function AnnouncementCard({
  announcement,
  showActions = false,
  onEdit,
  onDelete,
  onRefresh,
}: AnnouncementCardProps) {
  const priorityInfo = ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority];
  const statusInfo = ANNOUNCEMENT_STATUS_LABELS[announcement.status];

  const handleTogglePin = async () => {
    try {
      await announcementService.togglePin(announcement.id, announcement.pinned);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handlePublish = async () => {
    try {
      await announcementService.publishAnnouncement(announcement.id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to publish:', error);
    }
  };

  const handleArchive = async () => {
    try {
      await announcementService.archiveAnnouncement(announcement.id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  return (
    <div className={`bg-card rounded-xl shadow-sm border ${announcement.pinned ? 'border-primary/50' : 'border-border'} overflow-hidden transition-all`}>
      {announcement.pinned && (
        <div className="h-1 bg-primary w-full" />
      )}

      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {announcement.pinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/15 text-primary border border-primary/20">
                  <Pin className="w-3 h-3 fill-primary" />
                  Pinned
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border capitalize ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <h3 className="font-bold text-foreground text-base">
              {announcement.title}
            </h3>
          </div>

          {showActions && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleTogglePin}
                className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title={announcement.pinned ? 'Unpin' : 'Pin'}
                aria-label={announcement.pinned ? 'Unpin announcement' : 'Pin announcement'}
              >
                <Pin className={`w-4 h-4 ${announcement.pinned ? 'text-primary fill-primary' : ''}`} />
              </button>
              {announcement.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  className="w-11 h-11 flex items-center justify-center text-success hover:bg-success/10 rounded-lg transition-colors"
                  title="Publish"
                  aria-label="Publish announcement"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
              {announcement.status === 'published' && (
                <button
                  onClick={handleArchive}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Archive"
                  aria-label="Archive announcement"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(announcement)}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Edit"
                  aria-label="Edit announcement"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(announcement.id)}
                  className="w-11 h-11 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Delete"
                  aria-label="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-foreground text-sm mb-4 whitespace-pre-wrap leading-relaxed">
          {announcement.content}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">By {announcement.authorName}</span>
            <span>•</span>
            <span>
              {announcement.createdAt
                ? new Date(
                    typeof announcement.createdAt === 'object' && 'seconds' in announcement.createdAt
                      ? (announcement.createdAt as { seconds: number }).seconds * 1000
                      : announcement.createdAt as number
                  ).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                : ''}
            </span>
          </div>

          {announcement.targetRoles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span>Audience:</span>
              <div className="flex flex-wrap gap-1">
                {announcement.targetRoles.map(role => (
                  <span
                    key={role}
                    className="px-2 py-0.5 bg-muted text-foreground text-xs rounded font-medium"
                  >
                    {ROLE_LABELS[role]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {announcement.expiresAt && (
          <div className="mt-2 text-xs text-muted-foreground">
            Expires: {new Date(announcement.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
}

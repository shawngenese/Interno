import { announcementService } from '../services/announcementService';
import { ANNOUNCEMENT_PRIORITY_LABELS, ANNOUNCEMENT_STATUS_LABELS, ROLE_LABELS } from '../types';
import type { Announcement } from '../types';

interface AnnouncementCardProps {
  announcement: Announcement;
  showActions?: boolean;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (id: string) => void;
}

export function AnnouncementCard({
  announcement,
  showActions = false,
  onEdit,
  onDelete,
}: AnnouncementCardProps) {
  const priorityInfo = ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority];
  const statusInfo = ANNOUNCEMENT_STATUS_LABELS[announcement.status];

  const handleTogglePin = async () => {
    try {
      await announcementService.togglePin(announcement.id, announcement.pinned);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handlePublish = async () => {
    try {
      await announcementService.publishAnnouncement(announcement.id);
    } catch (error) {
      console.error('Failed to publish:', error);
    }
  };

  const handleArchive = async () => {
    try {
      await announcementService.archiveAnnouncement(announcement.id);
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] overflow-hidden">
      {announcement.pinned && (
        <div className="h-1 bg-blue-600" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {announcement.pinned && (
                <span className="text-blue-600 dark:text-blue-400">📌</span>
              )}
              <span className={`px-2 py-0.5 text-xs rounded-full ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <h3 className="font-semibold text-[#121212] dark:text-white">
              {announcement.title}
            </h3>
          </div>

          {showActions && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleTogglePin}
                className="p-1.5 text-[#757575] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] rounded-lg transition-colors"
                title={announcement.pinned ? 'Unpin' : 'Pin'}
              >
                {announcement.pinned ? '📌' : '📎'}
              </button>
              {announcement.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Publish"
                >
                  ✓
                </button>
              )}
              {announcement.status === 'published' && (
                <button
                  onClick={handleArchive}
                  className="p-1.5 text-[#757575] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] rounded-lg transition-colors"
                  title="Archive"
                >
                  📦
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(announcement)}
                  className="p-1.5 text-[#757575] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] rounded-lg transition-colors"
                  title="Edit"
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(announcement.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-[#555555] dark:text-[#9E9E9E] text-sm mb-3 whitespace-pre-wrap">
          {announcement.content}
        </p>

        <div className="flex items-center justify-between text-xs text-[#757575] dark:text-[#9E9E9E]">
          <div className="flex items-center gap-3">
            <span>By {announcement.authorName}</span>
            <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
          </div>

          {announcement.targetRoles.length > 0 && (
            <div className="flex items-center gap-1">
              <span>To:</span>
              {announcement.targetRoles.map(role => (
                <span
                  key={role}
                  className="px-1.5 py-0.5 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded"
                >
                  {ROLE_LABELS[role]}
                </span>
              ))}
            </div>
          )}
        </div>

        {announcement.expiresAt && (
          <div className="mt-2 text-xs text-[#757575] dark:text-[#9E9E9E]">
            Expires: {new Date(announcement.expiresAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

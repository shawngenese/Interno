import { announcementService } from '../services/announcementService';
import { ANNOUNCEMENT_PRIORITY_LABELS, ANNOUNCEMENT_STATUS_LABELS, ROLE_LABELS } from '../types';
import type { Announcement } from '../types';

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
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] overflow-hidden">
      {announcement.pinned && (
        <div className="h-1 bg-blue-600" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {announcement.pinned && (
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
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
                {announcement.pinned ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                )}
              </button>
              {announcement.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Publish"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </button>
              )}
              {announcement.status === 'published' && (
                <button
                  onClick={handleArchive}
                  className="p-1.5 text-[#757575] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] rounded-lg transition-colors"
                  title="Archive"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(announcement)}
                  className="p-1.5 text-[#757575] hover:text-[#3A3A3A] dark:hover:text-[#BDBDBD] hover:bg-[#EFEFEF] dark:hover:bg-[#3A3A3A] rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(announcement.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
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
            <span>{announcement.createdAt
              ? new Date(
                  typeof announcement.createdAt === 'object' && 'seconds' in announcement.createdAt
                    ? (announcement.createdAt as { seconds: number }).seconds * 1000
                    : announcement.createdAt as number
                ).toLocaleDateString()
              : ''
            }</span>
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

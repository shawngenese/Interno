import { useState, useEffect } from 'react';
import { announcementService } from '../services/announcementService';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementForm } from './AnnouncementForm';
import { useToast } from '@/shared/components/Toast';
import type { Announcement, AnnouncementStatus } from '../types';

interface AnnouncementListProps {
  companyId: string;
  role: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
}

export function AnnouncementList({ companyId, role }: AnnouncementListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterStatus, setFilterStatus] = useState<AnnouncementStatus | ''>('');
  const { addToast } = useToast();

  useEffect(() => {
    loadAnnouncements();
  }, [companyId, filterStatus]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements(companyId, {
        status: filterStatus || undefined,
      });
      setAnnouncements(data);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await announcementService.deleteAnnouncement(id);
      addToast('success', 'Announcement deleted');
      loadAnnouncements();
    } catch (error) {
      addToast('error', 'Failed to delete announcement');
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
    loadAnnouncements();
    addToast('success', editingAnnouncement ? 'Announcement updated' : 'Announcement created');
  };

  const showActions = role === 'admin' || role === 'coordinator';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Announcements
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as AnnouncementStatus | '')}
              aria-label="Filter by status"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            {showActions && (
              <button
                onClick={() => {
                  setEditingAnnouncement(null);
                  setShowForm(!showForm);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {showForm ? 'Cancel' : 'New Announcement'}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <AnnouncementForm
            companyId={companyId}
            announcement={editingAnnouncement}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingAnnouncement(null);
            }}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No announcements found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                showActions={showActions}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

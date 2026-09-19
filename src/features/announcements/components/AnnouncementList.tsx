import { useState, useEffect, useCallback, useRef } from 'react';
import { announcementService } from '../services/announcementService';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementForm } from './AnnouncementForm';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Announcement, AnnouncementStatus } from '../types';

interface AnnouncementListProps {
  companyId?: string;
  role?: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
}

export function AnnouncementList({ companyId: companyIdProp, role }: AnnouncementListProps) {
  const { user } = useAuth();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string>(companyIdProp || '');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterStatus, setFilterStatus] = useState<AnnouncementStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  // Resolve companyId for coordinator/supervisor if not passed as prop
  useEffect(() => {
    if (companyIdProp) {
      setResolvedCompanyId(companyIdProp);
      return;
    }
    if (!user?.uid) return;
    let cancelled = false;
    async function resolveCompanyId() {
      try {
        const db = getFirestoreInstancePublic();
        // Try coordinators collection first, then supervisors
        let snap = await getDoc(doc(db, 'coordinators', user!.uid));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'supervisors', user!.uid));
        }
        if (!cancelled && snap.exists()) {
          const data = snap.data();
          if (data.companyId) setResolvedCompanyId(data.companyId);
        }
      } catch (err) {
        console.error('Failed to resolve companyId for announcements:', err);
      }
    }
    resolveCompanyId();
    return () => { cancelled = true; };
  }, [user?.uid, companyIdProp]);

  const loadAnnouncements = useCallback(async (signal?: AbortSignal) => {
    // Admin sees all announcements (no companyId filter)
    if (role !== 'admin' && !resolvedCompanyId) return;
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements(
        role === 'admin' ? undefined : resolvedCompanyId,
        {
          status: filterStatus || undefined,
        }
      );
      if (!signal?.aborted) setAnnouncements(data);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Failed to load announcements:', err);
        setError('Failed to load announcements. Please try again.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [resolvedCompanyId, filterStatus, role]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadAnnouncements(controller.signal);
    return () => controller.abort();
  }, [loadAnnouncements]);

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await announcementService.deleteAnnouncement(id);
      addToast('success', 'Announcement deleted');
      loadAnnouncements();
    } catch {
      addToast('error', 'Failed to delete announcement');
    }
  };

  const handleFormSuccess = () => {
    const wasEditing = !!editingAnnouncement;
    setShowForm(false);
    setEditingAnnouncement(null);
    loadAnnouncements();
    addToast('success', wasEditing ? 'Announcement updated' : 'Announcement created');
  };

  const showActions = role === 'admin' || role === 'coordinator';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-[#121212] dark:text-white">
            Announcements
          </h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as AnnouncementStatus | '')}
              aria-label="Filter by status"
              className="px-4 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white"
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
            companyId={resolvedCompanyId}
            announcement={editingAnnouncement}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingAnnouncement(null);
            }}
          />
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => { setError(null); loadAnnouncements(); }} className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#EFEFEF] dark:bg-[#3A3A3A] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#757575] dark:text-[#9E9E9E]">No announcements found</p>
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
                onRefresh={() => loadAnnouncements()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

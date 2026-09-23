import { useState, useEffect, useCallback, useRef } from 'react';
import { announcementService } from '../services/announcementService';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementForm } from './AnnouncementForm';
import { useToast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Plus } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import type { Announcement, AnnouncementStatus, AnnouncementPriority } from '../types';

interface AnnouncementListProps {
  companyId?: string;
  viewerRole?: 'admin' | 'coordinator' | 'supervisor' | 'trainee';
}

export function AnnouncementList({ companyId: companyIdProp, viewerRole }: AnnouncementListProps) {
  const { user } = useAuth();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string>(companyIdProp || '');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filterStatus, setFilterStatus] = useState<AnnouncementStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<AnnouncementPriority | ''>('');
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const abortRef = useRef<AbortController | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Resolve companyId for coordinator/supervisor if not passed as prop
  // Trainees load all announcements (targetRoles filter handles visibility)
  useEffect(() => {
    if (companyIdProp) {
      setResolvedCompanyId(companyIdProp);
      return;
    }
    if (!user?.uid || viewerRole === 'trainee') return;
    let cancelled = false;
    async function resolveCompanyId() {
      try {
        const db = getFirestoreInstancePublic();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, companyIdProp, viewerRole]);

  const loadAnnouncements = useCallback(async (signal?: AbortSignal) => {
    // Admin sees all announcements (no companyId filter)
    // Trainees without companyId also see all (system-wide)
    if (viewerRole !== 'admin' && viewerRole !== 'trainee' && !resolvedCompanyId) return;
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements(
        viewerRole === 'admin' || (viewerRole === 'trainee' && !resolvedCompanyId) ? undefined : resolvedCompanyId,
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
  }, [resolvedCompanyId, filterStatus, viewerRole]);

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
    setConfirmDialog({
      title: 'Delete Announcement',
      message: 'Are you sure you want to delete this announcement?',
      danger: true,
      onConfirm: async () => {
        try {
          await announcementService.deleteAnnouncement(id);
          addToast('success', 'Announcement deleted');
          loadAnnouncements();
        } catch {
          addToast('error', 'Failed to delete announcement');
        }
      },
    });
  };

  const handleFormSuccess = () => {
    const wasEditing = !!editingAnnouncement;
    setShowForm(false);
    setEditingAnnouncement(null);
    loadAnnouncements();
    addToast('success', wasEditing ? 'Announcement updated' : 'Announcement created');
  };

  const showActions = viewerRole === 'admin' || viewerRole === 'coordinator';

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-sm border border-border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Announcements
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Stay updated with the latest news, notices, and updates</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {(viewerRole === 'admin' || viewerRole === 'coordinator') ? (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AnnouncementStatus | '')}
                aria-label="Filter by status"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            ) : (
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as AnnouncementPriority | '')}
                aria-label="Filter by priority"
                className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            )}
            {showActions && (
              <Button
                onClick={() => {
                  setEditingAnnouncement(null);
                  setShowForm(true);
                }}
                variant="primary"
                size="md"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Announcement
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <Modal
            open={showForm}
            title={editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            onClose={() => { setShowForm(false); setEditingAnnouncement(null); }}
          >
            <AnnouncementForm
              companyId={resolvedCompanyId}
              announcement={editingAnnouncement}
              onSuccess={handleFormSuccess}
              onCancel={() => { setShowForm(false); setEditingAnnouncement(null); }}
            />
          </Modal>
        )}

        {error && (
          <div role="alert" className="mb-4 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); loadAnnouncements(); }}>Retry</Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={120} className="rounded-xl" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            title="No announcements found"
            description="There are currently no active announcements or updates posted."
          />
        ) : (
          <div className="space-y-3">
            {announcements
              .filter((a) => !filterPriority || a.priority === filterPriority)
              .map((announcement) => (
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

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { announcementService } from '../services/announcementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ANNOUNCEMENT_PRIORITY_LABELS, ROLE_LABELS } from '../types';
import type { Announcement, AnnouncementFormData, AnnouncementPriority } from '../types';

interface AnnouncementFormProps {
  companyId?: string;
  announcement?: Announcement | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AnnouncementForm({
  companyId: companyIdProp,
  announcement,
  onSuccess,
  onCancel,
}: AnnouncementFormProps) {
  const { user, companyId: userCompanyId } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyIdProp || userCompanyId || '');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCompanySelection = !companyIdProp && !userCompanyId;

  useEffect(() => {
    if (needsCompanySelection) {
      const loadCompanies = async () => {
        try {
          const db = getFirestoreInstancePublic();
          const snap = await getDocs(query(collection(db, 'companies'), orderBy('name')));
          setCompanies(snap.docs.map(d => ({ id: d.id, name: d.data().name as string })));
        } catch (err) {
          console.error('Failed to load companies:', err);
        }
      };
      loadCompanies();
    }
  }, [needsCompanySelection]);

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setPriority(announcement.priority);
      setTargetRoles(announcement.targetRoles);
      setPinned(announcement.pinned);
      setSelectedCompanyId(announcement.companyId);
      setExpiresAt(
        announcement.expiresAt
          ? new Date(announcement.expiresAt).toISOString().split('T')[0]
          : ''
      );
    }
  }, [announcement]);

  const handleRoleToggle = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = async (asDraft: boolean = true) => {
    if (!user) return;
    setSaving(true);
    setError(null);

    const companyId = companyIdProp || userCompanyId || selectedCompanyId;
    if (!companyId) {
      setError('Please select a company');
      setSaving(false);
      return;
    }

    try {
      const data: AnnouncementFormData = {
        title,
        content,
        authorId: user.uid,
        authorName: user.displayName || user.email || 'Unknown',
        companyId,
        priority,
        status: asDraft ? 'draft' : 'published',
        targetRoles: targetRoles as ('admin' | 'coordinator' | 'supervisor' | 'trainee')[],
        pinned,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).getTime() } : {}),
      };

      if (announcement) {
        await announcementService.updateAnnouncement(announcement.id, data);
      } else {
        await announcementService.createAnnouncement(data);
      }
      onSuccess?.();
    } catch (err) {
      setError('Failed to save announcement');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
          {announcement ? 'Edit Announcement' : 'New Announcement'}
        </h3>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {needsCompanySelection && (
          <div>
            <label htmlFor="company-select" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Company
            </label>
            <select
              id="company-select"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="announcement-title" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Title
          </label>
          <input
            id="announcement-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter announcement title"
          />
        </div>

        <div>
          <label htmlFor="announcement-content" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Content
          </label>
          <textarea
            id="announcement-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Write your announcement content..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Priority
            </span>
            <div className="flex gap-2">
              {Object.entries(ANNOUNCEMENT_PRIORITY_LABELS).map(([value, { label, color }]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value as AnnouncementPriority)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    priority === value
                      ? 'bg-blue-600 text-white'
                      : `${color} hover:opacity-80`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="announcement-expires" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Expires At (optional)
            </label>
            <input
              id="announcement-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-2">
            Target Roles
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleToggle(role)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  targetRoles.includes(role)
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#EFEFEF] text-[#3A3A3A] dark:bg-[#3A3A3A] dark:text-[#BDBDBD] hover:bg-[#D5D5D5] dark:hover:bg-[#555555]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pinned"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-[#BDBDBD] rounded focus:ring-blue-500"
          />
          <label htmlFor="pinned" className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">
            Pin this announcement
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555]"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !title.trim() || !content.trim() || (needsCompanySelection && !selectedCompanyId)}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !title.trim() || !content.trim() || (needsCompanySelection && !selectedCompanyId)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

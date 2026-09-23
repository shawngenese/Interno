import { useState, useEffect } from 'react';
import { announcementService } from '../services/announcementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/shared/components/ui/Button';
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
    <div className="space-y-5">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      )}

      {needsCompanySelection && (
        <div>
          <label htmlFor="company-select" className="block text-xs font-semibold text-foreground mb-1.5">
            Target Company
          </label>
          <select
            id="company-select"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select Company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="announcement-title" className="block text-xs font-semibold text-foreground mb-1.5">
          Announcement Title
        </label>
        <input
          id="announcement-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="e.g. Schedule update, holiday notice, company policy..."
        />
      </div>

      <div>
        <label htmlFor="announcement-content" className="block text-xs font-semibold text-foreground mb-1.5">
          Content / Message
        </label>
        <textarea
          id="announcement-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full p-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="Write the full announcement details here..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="block text-xs font-semibold text-foreground mb-1.5">
            Priority Level
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ANNOUNCEMENT_PRIORITY_LABELS).map(([value, { label }]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value as AnnouncementPriority)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  priority === value
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-card border-border text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="announcement-expires" className="block text-xs font-semibold text-foreground mb-1.5">
            Expiration Date (optional)
          </label>
          <input
            id="announcement-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-foreground mb-1.5">
          Target Audience Roles
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleToggle(role)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                targetRoles.includes(role)
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-card border-border text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        <input
          type="checkbox"
          id="pinned"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="w-4 h-4 text-primary border-input rounded focus:ring-primary"
        />
        <label htmlFor="pinned" className="text-sm font-medium text-foreground cursor-pointer">
          Pin this announcement to top
        </label>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="secondary"
          isLoading={saving}
          disabled={!title.trim() || !content.trim() || (needsCompanySelection && !selectedCompanyId)}
          onClick={() => handleSave(true)}
        >
          Save Draft
        </Button>
        <Button
          variant="primary"
          isLoading={saving}
          disabled={!title.trim() || !content.trim() || (needsCompanySelection && !selectedCompanyId)}
          onClick={() => handleSave(false)}
        >
          Publish
        </Button>
      </div>
    </div>
  );
}

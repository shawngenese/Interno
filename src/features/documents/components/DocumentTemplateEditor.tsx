import { useState, useEffect } from 'react';
import { documentRequirementService } from '../services/documentRequirementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import type { DocumentRequirement, DocumentRequirementFormData, DocumentType, PlacementType } from '../types';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  endorsement: 'Endorsement Letter',
  agreement: 'Training Agreement',
  medical: 'Medical Certificate',
  consent: 'Consent Form',
  resume: 'Resume/CV',
  school_reqs: 'School Requirements',
  completion: 'Completion Certificate',
  other: 'Other',
};

const PLACEMENT_TYPE_LABELS: Record<PlacementType | 'all', string> = {
  internal: 'Internal Only',
  external: 'External Only',
  all: 'All Trainees',
};

export function DocumentTemplateEditor() {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DocumentRequirementFormData>({
    companyId: '',
    documentType: 'resume',
    label: '',
    description: '',
    requiredFor: 'all',
    required: true,
    order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) return;
      const userData = userSnap.data() as { companyId?: string };
      const cid = userData.companyId || '';
      setCompanyId(cid);
      setFormData(prev => ({ ...prev, companyId: cid }));

      const data = await documentRequirementService.getRequirements(cid);
      setRequirements(data);
    } catch (err) {
      console.error('Failed to load requirements:', err);
      setError('Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      companyId,
      documentType: 'resume',
      label: '',
      description: '',
      requiredFor: 'all',
      required: true,
      order: requirements.length,
    });
    setShowForm(true);
  };

  const handleEdit = (req: DocumentRequirement) => {
    setEditingId(req.id);
    setFormData({
      companyId: req.companyId,
      documentType: req.documentType,
      label: req.label,
      description: req.description,
      requiredFor: req.requiredFor,
      required: req.required,
      order: req.order,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await documentRequirementService.updateRequirement(editingId, formData);
      } else {
        await documentRequirementService.createRequirement(formData);
      }
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      setError('Failed to save requirement');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      title: 'Delete Requirement',
      message: 'Delete this requirement?',
      danger: true,
      onConfirm: async () => {
        try {
          await documentRequirementService.deleteRequirement(id);
          fetchData();
        } catch (err) {
          setError('Failed to delete requirement');
          console.error(err);
        }
      },
    });
  };

  const handleTypeChange = (type: DocumentType) => {
    setFormData(prev => ({
      ...prev,
      documentType: type,
      label: prev.label || DOCUMENT_TYPE_LABELS[type],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Document Requirements</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 min-h-[44px] text-sm font-medium text-on-primary bg-primary rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
        >
          Add Requirement
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl shadow-sm border border-border">
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground">
            Configure which documents are required for trainees at your company.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-primary mx-auto" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No document requirements configured. Click "Add Requirement" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Document Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Required For</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Required</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requirements.map((req) => (
                  <tr key={req.id} className="hover:bg-muted">
                    <td className="px-4 py-4 text-sm text-muted-foreground">{req.order}</td>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {DOCUMENT_TYPE_LABELS[req.documentType]}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">{req.label}</div>
                      <div className="text-xs text-muted-foreground">{req.description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        req.requiredFor === 'all'
                          ? 'bg-primary/10 text-primary'
                          : req.requiredFor === 'internal'
                          ? 'bg-success/15 text-success'
                          : 'bg-info/15 text-info'
                      }`}>
                        {PLACEMENT_TYPE_LABELS[req.requiredFor]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {req.required ? (
                        <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(req)}
                          className="px-3 py-1.5 min-h-[44px] text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="px-3 py-1.5 min-h-[44px] text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-border">
              <h4 className="text-lg font-semibold text-foreground">
                {editingId ? 'Edit Requirement' : 'Add Requirement'}
              </h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="doc-type-select" className="block text-sm font-medium text-foreground mb-1">
                  Document Type
                </label>
                <select
                  id="doc-type-select"
                  value={formData.documentType}
                  onChange={(e) => handleTypeChange(e.target.value as DocumentType)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="requirement-label" className="block text-sm font-medium text-foreground mb-1">
                  Label
                </label>
                <input
                  id="requirement-label"
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="e.g., Updated Resume"
                />
              </div>
              <div>
                <label htmlFor="requirement-description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  id="requirement-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Brief description of the requirement"
                />
              </div>
              <div>
                <label htmlFor="required-for-select" className="block text-sm font-medium text-foreground mb-1">
                  Required For
                </label>
                <select
                  id="required-for-select"
                  value={formData.requiredFor}
                  onChange={(e) => setFormData(prev => ({ ...prev, requiredFor: e.target.value as PlacementType | 'all' }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="all">All Trainees</option>
                  <option value="internal">Internal Only</option>
                  <option value="external">External Only</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
                  className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                />
                <label htmlFor="required" className="text-sm font-medium text-foreground">
                  Required
                </label>
              </div>
              <div>
                <label htmlFor="requirement-order" className="block text-sm font-medium text-foreground mb-1">
                  Order
                </label>
                <input
                  id="requirement-order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  min="0"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-foreground bg-card border border-input rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.label}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-on-primary bg-primary rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
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

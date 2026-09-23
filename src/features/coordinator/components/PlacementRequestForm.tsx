import { useState, useEffect } from 'react';
import { placementService } from '../services/placementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormSelect, FormTextarea } from '@/shared/components/FormField';

interface Company {
  id: string;
  name: string;
  address?: string;
}

interface PlacementRequestFormProps {
  onSuccess?: () => void;
}

export function PlacementRequestForm({ onSuccess }: PlacementRequestFormProps) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFormData,
  } = useFormValidation(
    { selectedCompanyId: '', requestNotes: '' },
    { selectedCompanyId: [required('Please select a company')] },
  );

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const q = query(
        collection(db, 'companies'),
        where('type', '==', 'external'),
        where('verified', '==', true),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        address: doc.data().address,
      })) as Company[];
      setCompanies(data);
    } catch (err) {
      setError('Failed to load companies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const onSubmit = async (data: { selectedCompanyId: string; requestNotes: string }) => {
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedCompany = companies.find((c) => c.id === data.selectedCompanyId);
      if (!selectedCompany) throw new Error('Company not found');

      await placementService.requestExternalPlacement(
        user.uid,
        user.displayName || user.email || 'Unknown',
        user.email || '',
        data.selectedCompanyId,
        selectedCompany.name,
        data.requestNotes,
      );
      setSuccess(true);
      setFormData({ selectedCompanyId: '', requestNotes: '' });
      onSuccess?.();
    } catch (err) {
      setError('Failed to submit placement request');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-green-800 dark:text-green-300">Request Submitted</h4>
            <p className="text-sm text-green-700 dark:text-green-400">
              Your external placement request has been submitted for coordinator review.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-2 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
          Request External Placement
        </h3>
        <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mt-1">
          Submit a request to be placed at an external company
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <FormField id="external-company" label="Select External Company" required error={touched.selectedCompanyId ? errors.selectedCompanyId : undefined}>
          {loading ? (
            <div className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-[#F5F5F5] dark:bg-[#3A3A3A] text-[#757575] dark:text-[#9E9E9E]">
              Loading companies...
            </div>
          ) : (
            <FormSelect
              id="external-company"
              value={formData.selectedCompanyId}
              onValueChange={handleChange('selectedCompanyId')}
              onBlur={handleBlur('selectedCompanyId')}
              error={touched.selectedCompanyId ? errors.selectedCompanyId : undefined}
            >
              <option value="">Select a company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} {company.address ? `- ${company.address}` : ''}
                </option>
              ))}
            </FormSelect>
          )}
        </FormField>

        <FormField id="request-notes" label="Request Notes (optional)">
          <FormTextarea
            id="request-notes"
            value={formData.requestNotes}
            onValueChange={handleChange('requestNotes')}
            onBlur={handleBlur('requestNotes')}
            rows={4}
            placeholder="Explain why you want to be placed at this company..."
          />
        </FormField>

        <div className="flex justify-end pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

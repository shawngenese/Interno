import { useState, useEffect } from 'react';
import { placementService } from '../services/placementService';
import { useAuth } from '@/features/auth';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

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
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const q = query(collection(db, 'companies'), where('type', '==', 'external'));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompanyId) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
      if (!selectedCompany) throw new Error('Company not found');

      await placementService.requestExternalPlacement(
        user.uid,
        user.displayName || user.email || 'Unknown',
        user.email || '',
        selectedCompanyId,
        selectedCompany.name,
        requestNotes,
      );
      setSuccess(true);
      setSelectedCompanyId('');
      setRequestNotes('');
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

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="external-company" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Select External Company <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-[#F5F5F5] dark:bg-[#3A3A3A] text-[#757575] dark:text-[#9E9E9E]">
              Loading companies...
            </div>
          ) : (
            <select
              id="external-company"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} {company.address ? `- ${company.address}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="request-notes" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Request Notes (optional)
          </label>
          <textarea
            id="request-notes"
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Explain why you want to be placed at this company..."
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="submit"
            disabled={submitting || !selectedCompanyId}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}

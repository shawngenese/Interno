import { useState, useEffect } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COMPANY_TYPES } from '@/config/constants';

interface Company {
  id: string;
  name: string;
  type?: string;
  verified?: boolean;
}

interface SupervisorInviteProps {
  onSuccess?: () => void;
}

export function SupervisorInvite({ onSuccess }: SupervisorInviteProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const q = query(
        collection(db, 'companies'),
        where('type', '==', COMPANY_TYPES.EXTERNAL),
        where('verified', '==', true)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        type: doc.data().type,
        verified: doc.data().verified,
      })) as Company[];
      setCompanies(data);
    } catch (err) {
      setError('Failed to load companies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !supervisorName || !supervisorEmail) return;

    setSubmitting(true);
    setError(null);

    try {
      const db = getFirestoreInstancePublic();
      
      // Create invitation record
      await addDoc(collection(db, 'supervisor_invitations'), {
        companyId: selectedCompanyId,
        supervisorName,
        supervisorEmail,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Call Cloud Function to send invitation email
      const functions = getFunctions();
      const sendInvite = httpsCallable(functions, 'sendSupervisorInvite');
      await sendInvite({
        companyId: selectedCompanyId,
        supervisorName,
        supervisorEmail,
      });

      setSuccess(true);
      setSelectedCompanyId('');
      setSupervisorName('');
      setSupervisorEmail('');
      onSuccess?.();
    } catch (err) {
      setError('Failed to send invitation');
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
            <h4 className="font-semibold text-green-800 dark:text-green-300">Invitation Sent</h4>
            <p className="text-sm text-green-700 dark:text-green-400">
              The supervisor will receive an email with instructions to set up their account.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-2 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
            >
              Send Another Invitation
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
          Invite External Supervisor
        </h3>
        <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mt-1">
          Send an invitation to a supervisor at an external company
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            External Company <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-[#F5F5F5] dark:bg-[#3A3A3A] text-[#757575] dark:text-[#9E9E9E]">
              Loading companies...
            </div>
          ) : (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Supervisor Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={supervisorName}
            onChange={(e) => setSupervisorName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Supervisor's full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
            Supervisor Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={supervisorEmail}
            onChange={(e) => setSupervisorEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white placeholder-[#9E9E9E] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="supervisor@company.com"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="submit"
            disabled={submitting || !selectedCompanyId}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </div>
  );
}

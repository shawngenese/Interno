import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import { COMPANY_TYPES } from '@/config/constants';

interface Company {
  id: string;
  name: string;
  type?: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  verified: boolean;
}

export function CompanyVerification() {
  const { user, role } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('unverified');

  const fetchCompanies = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirestoreInstancePublic();
      let q;
      if (filter === 'verified') {
        q = query(
          collection(db, 'companies'),
          where('type', '==', COMPANY_TYPES.EXTERNAL),
          where('verified', '==', true)
        );
      } else if (filter === 'unverified') {
        q = query(
          collection(db, 'companies'),
          where('type', '==', COMPANY_TYPES.EXTERNAL),
          where('verified', '==', false)
        );
      } else {
        q = query(
          collection(db, 'companies'),
          where('type', '==', COMPANY_TYPES.EXTERNAL)
        );
      }
      const snap = await getDocs(q);
      if (signal?.aborted) return;
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Company[];
      setCompanies(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError('Failed to load companies');
        console.error(err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCompanies(controller.signal);
    return () => controller.abort();
  }, [fetchCompanies]);

  const handleVerify = async (companyId: string) => {
    if (!user) return;
    if (!confirm('Verify this company?')) return;
    setProcessing(companyId);
    try {
      const db = getFirestoreInstancePublic();
      await updateDoc(doc(db, 'companies', companyId), {
        verified: true,
        verifiedBy: user.uid,
        verifiedAt: new Date(),
      });
      await addDoc(collection(db, 'audit_logs'), {
        timestamp: serverTimestamp(),
        userId: user.uid,
        action: 'update',
        entityType: 'company',
        entityId: companyId,
        originalValue: false,
        newValue: true,
        metadata: { field: 'verified' },
      });
      fetchCompanies();
    } catch (err) {
      setError('Failed to verify company');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const handleUnverify = async (companyId: string) => {
    if (!user) return;
    if (!confirm('Revoke verification for this company? This may affect supervisor access.')) return;
    setProcessing(companyId);
    try {
      const db = getFirestoreInstancePublic();
      await updateDoc(doc(db, 'companies', companyId), {
        verified: false,
        verifiedBy: null,
        verifiedAt: null,
      });
      await addDoc(collection(db, 'audit_logs'), {
        timestamp: serverTimestamp(),
        userId: user.uid,
        action: 'update',
        entityType: 'company',
        entityId: companyId,
        originalValue: true,
        newValue: false,
        metadata: { field: 'verified' },
      });
      fetchCompanies();
    } catch (err) {
      setError('Failed to unverify company');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
            Company Verification
          </h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'verified' | 'unverified')}
            className="px-3 py-2 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="unverified">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="all">All Companies</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-3 text-[#757575] dark:text-[#9E9E9E]">Loading companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-[#9E9E9E] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[#757575] dark:text-[#9E9E9E]">
              {filter === 'unverified' ? 'No companies pending verification' : 'No companies found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {companies.map((company) => (
              <div
                key={company.id}
                className="border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-[#121212] dark:text-white">{company.name}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${company.verified ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                        {company.verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                    {company.address && (
                      <p className="text-sm text-[#757575] dark:text-[#9E9E9E] mt-1">{company.address}</p>
                    )}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {company.contactPerson && (
                        <p className="text-sm text-[#555555] dark:text-[#BDBDBD]">
                          <span className="font-medium">Contact:</span> {company.contactPerson}
                        </p>
                      )}
                      {company.contactEmail && (
                        <p className="text-sm text-[#555555] dark:text-[#BDBDBD]">
                          <span className="font-medium">Email:</span> {company.contactEmail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(role === 'coordinator' || role === 'admin') && (
                      company.verified ? (
                        <button
                          onClick={() => handleUnverify(company.id)}
                          disabled={processing === company.id}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {processing === company.id ? 'Processing...' : 'Revoke Verification'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(company.id)}
                          disabled={processing === company.id}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {processing === company.id ? 'Processing...' : 'Verify Company'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

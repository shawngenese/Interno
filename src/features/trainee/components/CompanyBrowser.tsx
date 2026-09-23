import { useState, useEffect } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import { PlacementRequestForm } from '@/features/coordinator/components/PlacementRequestForm';

interface Company {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  verified: boolean;
}

export function CompanyBrowser() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();

      // Get current user's trainee doc to find their externalCompanyId
      let currentExternalCompanyId: string | null = null;
      if (user) {
        const traineeSnap = await getDocs(
          query(collection(db, 'trainees'), where('userId', '==', user.uid), limit(1))
        );
        if (!traineeSnap.empty) {
          const traineeData = traineeSnap.docs[0].data();
          currentExternalCompanyId = (traineeData.externalCompanyId as string) ?? null;
        }
      }

      const q = query(
        collection(db, 'companies'),
        where('type', '==', 'external'),
        where('verified', '==', true)
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Company[];
      // Exclude the company the trainee is currently placed at
      setCompanies(data.filter((c) => c.id !== currentExternalCompanyId));
    } catch (err) {
      setError('Failed to load companies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleRequestPlacement = (company: Company) => {
    setSelectedCompany(company);
    setShowRequestForm(true);
  };

  if (showRequestForm && selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowRequestForm(false);
              setSelectedCompany(null);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-foreground">
            Request Placement at {selectedCompany.name}
          </h2>
        </div>
        <PlacementRequestForm
          onSuccess={() => {
            setShowRequestForm(false);
            setSelectedCompany(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          Browse External Companies
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          View verified external companies where you can request placement
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-3 text-muted-foreground">Loading companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-muted-foreground">No verified external companies available at this time.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <div
                key={company.id}
                className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-foreground">{company.name}</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/15 text-success border border-success/20">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                </div>

                {company.address && (
                  <p className="text-sm text-muted-foreground mb-2">{company.address}</p>
                )}

                <div className="space-y-1 mb-4">
                  {company.contactPerson && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Contact:</span> {company.contactPerson}
                    </p>
                  )}
                  {company.contactEmail && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Email:</span> {company.contactEmail}
                    </p>
                  )}
                  {company.contactPhone && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Phone:</span> {company.contactPhone}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleRequestPlacement(company)}
                  className="w-full px-4 py-2 min-h-[44px] text-sm font-medium text-on-primary bg-primary rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                >
                  Request Placement
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

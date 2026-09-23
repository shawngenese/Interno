import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/features/auth';
import { COMPANY_TYPES } from '@/config/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { Building2, CheckCircle, XCircle, Mail, Phone, MapPin, User } from 'lucide-react';

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
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

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
    setConfirmDialog({
      title: 'Verify Partner Company',
      message: 'Verify this external company as an approved OJT partner?',
      onConfirm: async () => {
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
      },
    });
  };

  const handleUnverify = async (companyId: string) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Revoke Verification',
      message: 'Revoke verification for this company? This may affect supervisor access.',
      danger: true,
      onConfirm: async () => {
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
      },
    });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Company Verification
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and verify external companies before trainee placement
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'verified' | 'unverified')}
          className="h-10 px-3 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="unverified">Pending Verification</option>
          <option value="verified">Verified Partners</option>
          <option value="all">All External Companies</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton variant="text" width="40%" height={20} />
                  <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
                </div>
                <Skeleton variant="text" width="60%" height={16} />
              </div>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <EmptyState
            title={filter === 'unverified' ? 'No companies pending verification.' : 'No companies found'}
            description="External companies submitted by trainees or admins will appear here for verification."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {companies.map((company) => (
              <div
                key={company.id}
                className="border border-border rounded-xl p-4 sm:p-5 bg-card hover:bg-muted/20 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h4 className="font-semibold text-foreground text-base">{company.name}</h4>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          company.verified
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                        }`}
                      >
                        {company.verified ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Pending Verification
                          </>
                        )}
                      </span>
                    </div>

                    {company.address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{company.address}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
                      {company.contactPerson && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span>Contact: <strong className="text-foreground font-medium">{company.contactPerson}</strong></span>
                        </div>
                      )}
                      {company.contactEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span>{company.contactEmail}</span>
                        </div>
                      )}
                      {company.contactPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{company.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {(role === 'coordinator' || role === 'admin') && (
                      company.verified ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUnverify(company.id)}
                          isLoading={processing === company.id}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerify(company.id)}
                          isLoading={processing === company.id}
                        >
                          Verify
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        danger={confirmDialog?.danger}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

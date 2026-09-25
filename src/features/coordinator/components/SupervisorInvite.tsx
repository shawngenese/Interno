import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestoreInstancePublic, getFunctionsInstancePublic } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/features/auth';
import { COMPANY_TYPES } from '@/config/constants';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect } from '@/shared/components/FormField';
import { useToast } from '@/shared/components/Toast';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { CheckCircle2, UserPlus } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  type?: string;
  verified?: boolean;
}

interface SupervisorInviteProps {
  onSuccess?: () => void;
}

const validationRules = {
  selectedCompanyId: [required('Please select a company')],
  supervisorName: [required('Supervisor name is required')],
  supervisorEmail: [required('Email is required'), email('Enter a valid email')],
};

export function SupervisorInvite({ onSuccess }: SupervisorInviteProps) {
  const { role } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFormData,
  } = useFormValidation(
    { selectedCompanyId: '', supervisorName: '', supervisorEmail: '' },
    validationRules,
  );

  const { addToast } = useToast();

  const fetchCompanies = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();
      const q = query(
        collection(db, 'companies'),
        where('type', '==', COMPANY_TYPES.EXTERNAL),
        where('verified', '==', true)
      );
      const snap = await getDocs(q);
      if (signal?.aborted) return;
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        type: doc.data().type,
        verified: doc.data().verified,
      })) as Company[];
      setCompanies(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError('Failed to load verified companies');
        console.error(err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchCompanies(controller.signal);
    return () => controller.abort();
  }, [fetchCompanies]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [success]);

  const onSubmit = async (data: { selectedCompanyId: string; supervisorName: string; supervisorEmail: string }) => {
    setSubmitting(true);
    setError(null);

    try {
      const functions = getFunctionsInstancePublic();
      const sendInvite = httpsCallable(functions, 'sendSupervisorInvite');
      await sendInvite({
        companyId: data.selectedCompanyId,
        supervisorName: data.supervisorName,
        supervisorEmail: data.supervisorEmail,
      });

      setSuccess(true);
      addToast('success', 'Invite sent');
      setFormData({ selectedCompanyId: '', supervisorName: '', supervisorEmail: '' });
      onSuccess?.();
    } catch (err) {
      setError('Failed to send invitation. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-card border border-success/30 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-foreground text-base">Invite Sent</h4>
            <p className="text-sm text-muted-foreground">
              The external supervisor will receive an email invitation with instructions to create their account and manage trainees.
            </p>
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSuccess(false)}
              >
                Send Another Invite
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden max-w-2xl">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Invite External Supervisor
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send an account setup invite to a supervisor at a verified partner company
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        {error && (
          <div role="alert" className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        <FormField
          id="company-select"
          label="External Partner Company"
          required
          error={touched.selectedCompanyId ? errors.selectedCompanyId : undefined}
        >
          {loading ? (
            <Skeleton variant="rectangular" height={40} className="rounded-lg" />
          ) : (
            <FormSelect
              id="company-select"
              value={formData.selectedCompanyId}
              onValueChange={handleChange('selectedCompanyId')}
              onBlur={handleBlur('selectedCompanyId')}
              error={touched.selectedCompanyId ? errors.selectedCompanyId : undefined}
            >
              <option value="">Select a verified company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </FormSelect>
          )}
        </FormField>

        <FormField
          id="supervisor-name"
          label="Supervisor Name"
          required
          error={touched.supervisorName ? errors.supervisorName : undefined}
        >
          <FormInput
            id="supervisor-name"
            type="text"
            value={formData.supervisorName}
            onValueChange={handleChange('supervisorName')}
            onBlur={handleBlur('supervisorName')}
            error={touched.supervisorName ? errors.supervisorName : undefined}
            placeholder="e.g. John Smith"
          />
        </FormField>

        <FormField
          id="supervisor-email"
          label="Supervisor Email"
          required
          error={touched.supervisorEmail ? errors.supervisorEmail : undefined}
        >
          <FormInput
            id="supervisor-email"
            type="email"
            value={formData.supervisorEmail}
            onValueChange={handleChange('supervisorEmail')}
            onBlur={handleBlur('supervisorEmail')}
            error={touched.supervisorEmail ? errors.supervisorEmail : undefined}
            placeholder="supervisor@company.com"
          />
        </FormField>

        <div className="flex justify-end pt-4 border-t border-border">
          {(role === 'coordinator' || role === 'admin') && (
            <Button
              variant="primary"
              type="submit"
              disabled={!formData.selectedCompanyId}
              isLoading={submitting}
            >
              Send Invite
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

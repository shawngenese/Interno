import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { CompanyFormData } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required, email } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/Skeleton';

interface CompanyFormProps {
  editingId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

const initialValues: CompanyFormData = {
  name: '',
  type: 'internal',
  address: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  verified: false,
};

export function CompanyForm({ editingId, onCancel, onSaved }: CompanyFormProps) {
  const isEditing = !!editingId;

  const {
    formData,
    setFormData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
  } = useFormValidation<CompanyFormData>(initialValues, {
    name: [required('Company name is required')],
    type: [required('Company type is required')],
    contactEmail: [email('Enter a valid email')],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompany = useCallback(async (companyId: string) => {
    try {
      const company = await adminService.getCompany(companyId);
      setFormData({
        name: company.name,
        type: company.type || 'internal',
        address: company.address || '',
        contactPerson: company.contactPerson || '',
        contactEmail: company.contactEmail || '',
        contactPhone: company.contactPhone || '',
        verified: company.verified || false,
      });
    } catch (err) {
      setError('Failed to load company');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setFormData]);

  useEffect(() => {
    if (isEditing && editingId) {
      loadCompany(editingId);
    } else {
      setLoading(false);
    }
  }, [editingId, isEditing, loadCompany]);

  const onSubmit = async (data: CompanyFormData) => {
    setError(null);
    setSaving(true);

    try {
      if (isEditing && editingId) {
        await adminService.updateCompany(editingId, data);
      } else {
        await adminService.createCompany(data);
      }
      onSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save company';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton variant="text" width="50%" height={24} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton variant="rectangular" height={40} className="sm:col-span-2" />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={80} className="sm:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <FormField
        id="name"
        label="Company Name"
        required
        error={touched.name ? errors.name : undefined}
      >
        <FormInput
          id="name"
          value={formData.name}
          onValueChange={handleChange('name')}
          onBlur={handleBlur('name')}
          error={touched.name ? errors.name : undefined}
          placeholder="e.g. Acme Corporation"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id="type"
          label="Company Type"
          required
          error={touched.type ? errors.type : undefined}
        >
          <FormSelect
            id="type"
            value={formData.type}
            onValueChange={handleChange('type')}
            onBlur={handleBlur('type')}
            error={touched.type ? errors.type : undefined}
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </FormSelect>
        </FormField>

        <FormField
          id="contactPerson"
          label="Contact Person"
          error={touched.contactPerson ? errors.contactPerson : undefined}
        >
          <FormInput
            id="contactPerson"
            value={formData.contactPerson}
            onValueChange={handleChange('contactPerson')}
            onBlur={handleBlur('contactPerson')}
            error={touched.contactPerson ? errors.contactPerson : undefined}
            placeholder="Contact Person Name"
          />
        </FormField>
      </div>

      <FormField
        id="address"
        label="Address"
        error={touched.address ? errors.address : undefined}
      >
        <FormTextarea
          id="address"
          value={formData.address}
          onValueChange={handleChange('address')}
          onBlur={handleBlur('address')}
          error={touched.address ? errors.address : undefined}
          rows={3}
          placeholder="Street address, city, state, postal code"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          id="contactEmail"
          label="Contact Email"
          error={touched.contactEmail ? errors.contactEmail : undefined}
        >
          <FormInput
            id="contactEmail"
            type="email"
            value={formData.contactEmail}
            onValueChange={handleChange('contactEmail')}
            onBlur={handleBlur('contactEmail')}
            error={touched.contactEmail ? errors.contactEmail : undefined}
            placeholder="contact@company.com"
          />
        </FormField>

        <FormField
          id="contactPhone"
          label="Contact Phone"
          error={touched.contactPhone ? errors.contactPhone : undefined}
        >
          <FormInput
            id="contactPhone"
            type="tel"
            value={formData.contactPhone}
            onValueChange={handleChange('contactPhone')}
            onBlur={handleBlur('contactPhone')}
            error={touched.contactPhone ? errors.contactPhone : undefined}
            placeholder="+63 9XX XXX XXXX"
          />
        </FormField>
      </div>

      {formData.type === 'external' && (
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
          <input
            type="checkbox"
            id="verified"
            checked={formData.verified}
            onChange={(e) => setFieldValue('verified', e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
          />
          <label htmlFor="verified" className="text-sm font-medium text-foreground cursor-pointer">
            Verified Partner Company
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" isLoading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

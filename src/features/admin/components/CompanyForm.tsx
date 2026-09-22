import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import type { CompanyFormData } from '../types';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { required } from '@/shared/utils/validators';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormField';

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
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompany = async (companyId: string) => {
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
  };

  useEffect(() => {
    if (isEditing && editingId) {
      loadCompany(editingId);
    } else {
      setLoading(false);
    }
  }, [editingId, isEditing]);

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

  const handleCancel = () => {
    onCancel?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-[#121212] dark:text-white mb-6">
        {isEditing ? 'Edit Company' : 'Create Company'}
      </h2>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            placeholder="Company Name"
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
            placeholder="Company Address"
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
              placeholder="+1 (555) 123-4567"
            />
          </FormField>
        </div>

        {isEditing && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verified"
              checked={formData.verified}
              onChange={(e) => setFieldValue('verified', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-[#BDBDBD] rounded"
            />
            <label htmlFor="verified" className="text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">
              Verified (External Company)
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D5D5D5] dark:border-[#3A3A3A]">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] bg-white dark:bg-[#3A3A3A] border border-[#BDBDBD] dark:border-[#555555] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
}

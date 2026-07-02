import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';

export interface ValidationField {
  name: string;
  label: string;
  value: string | undefined;
  rules: ValidationRule[];
  error?: string;
  touched?: boolean;
}

export interface ValidationRule {
  rule: (value: string) => boolean;
  message: string;
}

interface FormValidatorProps {
  fields: ValidationField[];
  onChange: (fieldName: string, value: string) => void;
  onBlur?: (fieldName: string) => void;
}

export const useFormValidator = (initialFields: ValidationField[]) => {
  const [fields, setFields] = useState<ValidationField[]>(initialFields);
  const [submitting, setSubmitting] = useState(false);

  const validateField = (fieldName: string): boolean => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return false;

    for (const rule of field.rules) {
      if (!rule.rule(field.value || '')) {
        const updatedFields = fields.map(f =>
          f.name === fieldName ? { ...f, error: rule.message, touched: true } : f
        );
        setFields(updatedFields);
        return false;
      }
    }

    const updatedFields = fields.map(f =>
      f.name === fieldName ? { ...f, error: undefined, touched: true } : f
    );
    setFields(updatedFields);
    return true;
  };

  const validateAll = (): boolean => {
    let isValid = true;
    const updatedFields = fields.map(field => {
      let hasError = false;
      for (const rule of field.rules) {
        if (!rule.rule(field.value || '')) {
          isValid = false;
          hasError = true;
          return { ...field, error: rule.message, touched: true };
        }
      }
      return { ...field, error: undefined, touched: true };
    });
    setFields(updatedFields);
    return isValid;
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    const updatedFields = fields.map(f =>
      f.name === fieldName ? { ...f, value } : f
    );
    setFields(updatedFields);
  };

  const handleFieldBlur = (fieldName: string) => {
    validateField(fieldName);
  };

  const resetForm = () => {
    setFields(initialFields.map(f => ({ ...f, error: undefined, touched: false })));
  };

  return {
    fields,
    handleFieldChange,
    handleFieldBlur,
    validateField,
    validateAll,
    resetForm,
    setSubmitting,
    submitting,
  };
};

interface FormInputProps {
  field: ValidationField;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  field,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required = false,
}) => {
  const hasError = field.touched && field.error;
  const isValid = field.touched && !field.error && field.value;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[var(--text-primary)] block">
        {field.label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={field.value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || field.label}
          className={`
            w-full px-4 py-2.5 rounded-xl border-2 transition-colors
            ${
              hasError
                ? 'border-red-300 bg-red-50 focus:border-red-500 focus:outline-none'
                : isValid
                ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500 focus:outline-none'
                : 'border-[var(--border-light)] bg-[var(--bg-card)] focus:border-primary focus:outline-none'
            }
          `}
        />
        {hasError && <AlertCircle size={18} className="absolute right-3 top-3 text-red-500" />}
        {isValid && <CheckCircle2 size={18} className="absolute right-3 top-3 text-emerald-500" />}
      </div>
      {hasError && <p className="text-xs text-red-600 font-medium mt-1">{field.error}</p>}
    </div>
  );
};

interface ConfirmationDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--bg-card)] rounded-3xl p-6 max-w-sm shadow-2xl animate-pop-in space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl font-semibold bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 py-2.5 px-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50
              flex items-center justify-center gap-2
              ${isDangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'}
            `}
          >
            {isLoading && <Loader size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

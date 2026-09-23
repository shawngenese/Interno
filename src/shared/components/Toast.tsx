import { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 md:px-0"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; containerClass: string; iconClass: string }> = {
  success: {
    icon: <CheckCircle2 size={18} aria-hidden="true" />,
    containerClass: 'bg-card border border-success/30',
    iconClass: 'text-success',
  },
  error: {
    icon: <XCircle size={18} aria-hidden="true" />,
    containerClass: 'bg-card border border-destructive/30',
    iconClass: 'text-destructive',
  },
  info: {
    icon: <Info size={18} aria-hidden="true" />,
    containerClass: 'bg-card border border-info/30',
    iconClass: 'text-info',
  },
  warning: {
    icon: <AlertTriangle size={18} aria-hidden="true" />,
    containerClass: 'bg-card border border-warning/30',
    iconClass: 'text-warning',
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const { icon, containerClass, iconClass } = toastConfig[toast.type];

  return (
    <div
      className={[
        'flex items-start gap-3 p-3 rounded-lg shadow-md',
        containerClass,
      ].join(' ')}
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <span className={`shrink-0 mt-0.5 ${iconClass}`}>{icon}</span>
      <p className="text-sm text-foreground flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

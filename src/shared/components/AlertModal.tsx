import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './ui/Button';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertModalProps {
  open: boolean;
  title: string;
  message: string;
  type?: AlertType;
  buttonLabel?: string;
  onClose: () => void;
}

const typeConfig: Record<AlertType, { icon: React.ReactNode; colorClass: string }> = {
  info:    { icon: <Info    size={20} aria-hidden="true" />, colorClass: 'text-info' },
  success: { icon: <CheckCircle2 size={20} aria-hidden="true" />, colorClass: 'text-success' },
  warning: { icon: <AlertTriangle size={20} aria-hidden="true" />, colorClass: 'text-warning' },
  error:   { icon: <XCircle size={20} aria-hidden="true" />, colorClass: 'text-destructive' },
};

export function AlertModal({
  open,
  title,
  message,
  type = 'info',
  buttonLabel = 'OK',
  onClose,
}: AlertModalProps) {
  const { icon, colorClass } = typeConfig[type];

  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <div className="p-5 space-y-4">
        <div className={`flex items-start gap-3 ${colorClass}`}>
          <span className="shrink-0 mt-0.5">{icon}</span>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant={type === 'error' ? 'destructive' : type === 'warning' ? 'accent' : 'primary'}
            onClick={onClose}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

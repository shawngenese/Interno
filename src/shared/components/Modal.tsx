import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-foreground/50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={[
              'relative w-full mx-4 max-h-[85vh] flex flex-col',
              'bg-card border border-border rounded-xl shadow-lg',
              sizeClasses[size],
            ].join(' ')}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2
                id="modal-title"
                className="text-base font-semibold text-foreground"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="min-w-11 min-h-11 -mr-1 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable content — padded by default so children never touch edges */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

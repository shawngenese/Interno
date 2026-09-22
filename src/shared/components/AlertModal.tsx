import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertModalProps {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export function AlertModal({
  open,
  title,
  message,
  buttonLabel = 'OK',
  onClose,
}: AlertModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-dialog-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            role="button"
            tabIndex={-1}
            aria-label="Close dialog"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white dark:bg-[#1E1E1E] rounded-xl shadow-xl max-w-sm w-full p-6 border border-[#D5D5D5] dark:border-[#3A3A3A]"
          >
            <h3 id="alert-dialog-title" className="text-lg font-semibold text-[#121212] dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-sm text-[#555555] dark:text-[#9E9E9E] mb-6">
              {message}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                {buttonLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

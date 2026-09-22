import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) {
      onClose();
    }
    setDragOffset(0);
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    setDragOffset(info.offset.x);
  };

  const backdropOpacity = Math.max(0, 1 - dragOffset / 300);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            role="button"
            tabIndex={-1}
            aria-label="Close modal"
          />

          {/* Mobile: full-screen slide-in */}
          <motion.div
            ref={contentRef}
            initial={{ x: '100%' }}
            animate={{ x: dragOffset }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col bg-white dark:bg-[#1E1E1E] md:relative md:inset-auto md:my-auto md:mx-auto md:max-w-lg md:rounded-xl md:shadow-xl md:border md:border-[#D5D5D5] md:dark:border-[#3A3A3A]"
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#D5D5D5] dark:border-[#3A3A3A] shrink-0">
              <h2 id="modal-title" className="text-lg font-semibold text-[#121212] dark:text-white">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-2 text-[#757575] dark:text-[#9E9E9E] hover:text-[#121212] dark:hover:text-white rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#3A3A3A] transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

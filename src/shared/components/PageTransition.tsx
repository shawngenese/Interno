import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          type: 'spring' as const,
          stiffness: 260,
          damping: 20,
        },
      }}
      exit={{
        opacity: 0,
        y: -8,
        transition: { duration: 0.15 },
      }}
    >
      {children}
    </motion.div>
  );
}

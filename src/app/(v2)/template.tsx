'use client';
import { motion } from 'framer-motion';
import { distance, duration, ease } from '@/lib/motion';

/** Route transition: each screen fades and rises in. Becomes a plain fade under reduced motion. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: distance.rise }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: ease.spring }}>
      {children}
    </motion.div>
  );
}

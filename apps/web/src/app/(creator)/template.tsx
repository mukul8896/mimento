'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Every creator page arrives the same gentle way (a short rise and fade), so moving from
 * Create Experience to Personalize to publishing feels like one continuous experience.
 * `template` (unlike `layout`) remounts on each navigation, which is what plays it again.
 */
export default function CreatorTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

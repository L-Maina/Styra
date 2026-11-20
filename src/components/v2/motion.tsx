'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { distance, duration, ease, stagger } from '@/lib/motion';

/** Rises into view once, when scrolled to. The first six siblings stagger (cards 60 ms, list rows 30 ms). */
export const ROW_STEP = 0.03;

export function Reveal({ children, index = 0, step = stagger.step, className, as = 'div' }: { children: ReactNode; index?: number; step?: number; className?: string; as?: 'div' | 'li' | 'section' }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: distance.rise * 2 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: duration.slow, ease: ease.spring, delay: Math.min(index, stagger.max) * step }}
    >
      {children}
    </Tag>
  );
}

/** The motto, set in display type, rises word by word on first paint. */
export function RisingWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text} role="text">
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ duration: duration.slow * 1.4, ease: ease.spring, delay: 0.08 + i * stagger.step * 1.4 }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Fades and rises after the hero words land. */
export function FadeUp({ children, delay = 0.35, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: distance.rise }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow, ease: ease.spring, delay }}>
      {children}
    </motion.div>
  );
}

/** Business cover: drifts slower than the page and gently zooms as it leaves (parallax), content layer only. */
export function ParallaxCover({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ''}`}>
      <motion.div style={{ y, scale, opacity }} className="h-full w-full will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}

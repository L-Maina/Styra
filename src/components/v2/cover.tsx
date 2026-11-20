import { cn } from '@/lib/utils';

/**
 * Cover art until a business uploads photos: a tonal field from its category with the initial set in Syne.
 * Content layer, opaque. Deterministic per business so it never shifts between renders.
 */
const HUES: Record<string, [number, number]> = {
  BARBER: [232, 258],
  HAIR: [280, 312],
  BRAIDS: [20, 340],
  NAILS: [330, 300],
  MASSAGE: [170, 200],
  SPA: [190, 215],
  MAKEUP: [350, 15],
  OTHER: [240, 270],
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function Cover({ name, category, className, size = 'card' }: { name: string; category: string; className?: string; size?: 'card' | 'hero' }) {
  const [a, b] = HUES[category] ?? HUES.OTHER;
  const shift = (hash(name) % 24) - 12;
  const style = {
    background: `radial-gradient(120% 90% at 18% 12%, oklch(0.62 0.13 ${a + shift}) 0%, transparent 60%),
                 radial-gradient(100% 80% at 90% 100%, oklch(0.48 0.14 ${b + shift}) 0%, transparent 65%),
                 oklch(0.24 0.04 ${a})`,
  };
  return (
    <div aria-hidden className={cn('relative overflow-hidden', className)} style={style}>
      <span
        className={cn(
          'absolute select-none font-[family-name:var(--font-syne)] font-bold uppercase leading-none text-white/[0.14]',
          size === 'hero' ? '-bottom-10 right-4 text-[220px]' : '-bottom-6 right-3 text-[120px]',
        )}
      >
        {name.trim()[0]}
      </span>
    </div>
  );
}

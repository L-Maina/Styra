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

export function Cover({ name, category, className, size = 'card' }: { name: string; category: string; className?: string; size?: 'card' | 'hero' | 'avatar' }) {
  const [a, b] = HUES[category] ?? HUES.OTHER;
  const shift = (hash(name) % 24) - 12;
  const style = {
    background: `radial-gradient(120% 90% at 18% 12%, oklch(0.62 0.13 ${a + shift}) 0%, transparent 60%),
                 radial-gradient(100% 80% at 90% 100%, oklch(0.48 0.14 ${b + shift}) 0%, transparent 65%),
                 oklch(0.24 0.04 ${a})`,
  };
  return (
    <div aria-hidden className={cn('relative overflow-hidden', className)} style={style}>
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_25%_15%,rgb(255_255_255/0.22),transparent_60%)] mix-blend-soft-light" />
      <span aria-hidden className="absolute -right-1/4 -top-1/3 aspect-square w-[85%] rounded-full border border-white/10" />
      <span aria-hidden className="absolute -right-[10%] -top-[15%] aspect-square w-[55%] rounded-full border border-white/[0.07]" />
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }}
      />
      <span
        className={cn(
          'absolute select-none font-[family-name:var(--font-syne)] font-bold uppercase leading-none text-white/[0.14]',
          size === 'hero' ? '-bottom-10 right-4 text-[220px]' : size === 'avatar' ? 'inset-0 grid place-items-center text-[22px] text-white/90' : '-bottom-6 right-3 text-[120px]',
        )}
      >
        {name.trim()[0]}
      </span>
    </div>
  );
}

/** The same art as a small rounded tile: bookings, the provider console, admin and chat. */
export function CoverAvatar({ name, category, className = 'size-12' }: { name: string; category: string; className?: string }) {
  return <Cover name={name} category={category} size="avatar" className={cn('shrink-0 rounded-2xl', className)} />;
}

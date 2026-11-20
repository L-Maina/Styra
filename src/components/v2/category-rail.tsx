import Link from 'next/link';
import { t } from '@/core/copy';
import { cn } from '@/lib/utils';

const CATS = ['BARBER', 'BRAIDS', 'HAIR', 'NAILS', 'SPA', 'MASSAGE', 'MAKEUP'] as const;

/** Content layer: opaque chips that scroll sideways. */
export function CategoryRail({ active }: { active?: string }) {
  return (
    <nav aria-label={t('browse.categories')} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-2">
        {CATS.map((c) => (
          <li key={c}>
            <Link
              href={active === c ? '/explore' : `/explore?category=${c}`}
              aria-current={active === c ? 'true' : undefined}
              className={cn(
                'press flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-[15px] font-semibold',
                active === c ? 'border-foreground bg-foreground text-background' : 'border-[var(--hairline)] bg-[var(--surface-1)]',
              )}
            >
              {t(`browse.category.${c}` as never)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

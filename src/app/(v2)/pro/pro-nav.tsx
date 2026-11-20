import Link from 'next/link';
import { t } from '@/core/copy';
import { cn } from '@/lib/utils';

export function ProNav({ active }: { active: 'today' | 'services' | 'hours' | 'earnings' | 'photos' }) {
  const items = [
    { key: 'today', href: '/pro', label: t('nav.dashboard') },
    { key: 'services', href: '/pro/services', label: t('pro.servicesTitle') },
    { key: 'hours', href: '/pro/hours', label: t('pro.hoursTitle') },
    { key: 'photos', href: '/pro/photos', label: t('nav.photos') },
    { key: 'earnings', href: '/pro/earnings', label: t('nav.earnings') },
  ] as const;
  return (
    <nav aria-label={t('nav.dashboard')} className="flex gap-2 overflow-x-auto">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={active === i.key ? 'page' : undefined}
          className={cn('flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[15px] font-semibold', active === i.key ? 'bg-foreground text-background' : 'border border-[var(--hairline)] bg-[var(--surface-1)]')}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

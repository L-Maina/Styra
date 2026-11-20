'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Compass, Home, MapPin, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { t } from '@/core/copy';
import { cn } from '@/lib/utils';
import { Glass } from './glass';

interface ShellUser {
  name: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
}

const TABS = [
  { href: '/', label: t('nav.home'), icon: Home },
  { href: '/explore', label: t('nav.explore'), icon: Compass },
  { href: '/near', label: t('nav.near'), icon: MapPin },
  { href: '/bookings', label: t('nav.bookings'), icon: CalendarDays },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** Floating glass top bar (all widths) and a floating glass tab bar on phones: the functional layer. */
export function Shell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const path = usePathname();
  const account = user
    ? { href: user.role === 'PROVIDER' ? '/pro' : user.role === 'ADMIN' ? '/admin' : '/profile', label: user.role === 'PROVIDER' ? t('nav.dashboard') : user.role === 'ADMIN' ? t('nav.admin') : t('nav.profile') }
    : { href: '/signin', label: t('actions.signIn') };
  return (
    <>
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-background focus:px-4 focus:py-2">
        {t('nav.skipToContent')}
      </a>
      {/* Scroll-edge effect: content fades under the bar instead of meeting a hard edge. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-background via-background/70 to-transparent" />
      <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-3">
        <Glass as="nav" aria-label={t('nav.main')} className="flex h-14 w-full max-w-5xl items-center justify-between gap-2 rounded-full pl-5 pr-2">
          <Link href="/" aria-label={t('brand.name')} className="flex min-h-11 items-center">
            <BrandLogo variant="full" size={26} />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {TABS.slice(1).map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive(path, tab.href) ? 'page' : undefined}
                className={cn('flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold', isActive(path, tab.href) ? 'bg-foreground/10' : 'hover:bg-foreground/[0.06]')}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <Link href={account.href} className="flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold hover:bg-foreground/[0.06]">
            <UserRound aria-hidden className="size-5" />
            <span>{user ? user.name.split(' ')[0] : account.label}</span>
          </Link>
        </Glass>
      </header>
      <main id="content" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-24 md:pb-16">
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-4 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Glass as="nav" aria-label={t('nav.tabs')} className="grid h-16 w-full max-w-md grid-cols-5 rounded-full px-2">
          {[...TABS, { href: account.href, label: account.label, icon: UserRound }].map((tab) => {
            const active = isActive(path, tab.href);
            return (
              <Link key={tab.href + tab.label} href={tab.href} aria-current={active ? 'page' : undefined} className="flex flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold">
                <tab.icon aria-hidden className={cn('size-6', active ? 'text-primary' : 'text-foreground')} strokeWidth={active ? 2.4 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </Glass>
      </div>
    </>
  );
}

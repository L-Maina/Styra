import Image from 'next/image';
import { t } from '@/core/copy';
import { cn } from '@/lib/utils';
import { Cover, CoverAvatar } from './cover';

/** The business's banner photo, or its tonal cover art when it has none. */
export function BusinessCover({ name, category, coverUrl, className, size = 'card', sizes = '(max-width: 768px) 100vw, 33vw', priority }: { name: string; category: string; coverUrl?: string | null; className?: string; size?: 'card' | 'hero'; sizes?: string; priority?: boolean }) {
  if (!coverUrl) return <Cover name={name} category={category} size={size} className={className} />;
  return (
    <div className={cn('relative overflow-hidden bg-[var(--surface-2)]', className)}>
      <Image src={coverUrl} alt={t('business.coverAlt', { name })} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

/** The business logo, or the cover-art tile with its initial. */
export function BusinessAvatar({ name, category, logoUrl, className = 'size-12' }: { name: string; category: string; logoUrl?: string | null; className?: string }) {
  if (!logoUrl) return <CoverAvatar name={name} category={category} className={className} />;
  return (
    <span className={cn('relative block shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-2)]', className)}>
      <Image src={logoUrl} alt={t('business.logoAlt', { name })} fill sizes="96px" className="object-cover" />
    </span>
  );
}

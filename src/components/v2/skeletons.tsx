import { t } from '@/core/copy';

/** Loading shapes that match the real layout, so nothing jumps when content arrives. */
export function Sk({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function Busy({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={t('system.loading')}>
      {children}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)]">
          <Sk className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Sk className="h-5 w-2/3" />
            <Sk className="h-4 w-1/2" />
            <Sk className="h-4 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HomeSkeleton() {
  return (
    <Busy>
      <div className="space-y-10 pt-12">
        <div className="space-y-4">
          <Sk className="h-14 w-4/5 md:h-24" />
          <Sk className="h-14 w-3/5 md:h-24" />
          <Sk className="h-5 w-2/3 max-w-xl" />
          <Sk className="mt-4 h-14 w-full max-w-xl rounded-full" />
        </div>
        <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <Sk key={i} className="h-11 w-24 rounded-full" />)}</div>
        <CardGridSkeleton />
      </div>
    </Busy>
  );
}

export function BusinessSkeleton() {
  return (
    <Busy>
      <Sk className="-mx-4 -mt-24 h-[46vh] min-h-[300px] rounded-none md:mx-0 md:mt-0 md:h-[400px] md:rounded-[32px]" />
      <div className="space-y-3 pt-6">
        <Sk className="h-10 w-2/3" />
        <Sk className="h-4 w-1/2" />
        <Sk className="h-4 w-4/5" />
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }, (_, i) => <Sk key={i} className="h-16 w-full" />)}
      </div>
    </Busy>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Busy>
      <div className="space-y-6 pt-2">
        <Sk className="h-9 w-48" />
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="space-y-2 rounded-3xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
              <Sk className="h-5 w-1/2" />
              <Sk className="h-4 w-1/3" />
              <Sk className="h-7 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

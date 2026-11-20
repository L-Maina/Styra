import { CardGridSkeleton, Sk } from '@/components/v2/skeletons';

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <Sk className="h-14 w-full rounded-full" />
      <CardGridSkeleton />
    </div>
  );
}

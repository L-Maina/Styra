import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { currentUser } from '@/lib/v2/session';
import { getDb } from '@/server/db-pool';
import { listOwnPhotos } from '@/server/services/photos';
import { getOwnBusiness } from '@/server/services/pro';
import { ProNav } from '../pro-nav';
import { PhotoManager } from './photo-manager';

export const dynamic = 'force-dynamic';

export default async function ProPhotos() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/pro/photos');
  if (user.role !== 'PROVIDER') redirect('/pro');
  const db = getDb();
  const [photos, biz] = await Promise.all([listOwnPhotos(db, user), getOwnBusiness(db, user)]);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-sans text-[28px] font-semibold normal-case">{t('pro.photosTitle')}</h1>
        <ProNav active="photos" />
      </div>
      <p className="max-w-2xl text-[15px] text-muted-foreground">{t('pro.photosLead')}</p>
      <PhotoManager photos={photos} business={{ name: String(biz.name), category: String(biz.category) }} />
    </div>
  );
}

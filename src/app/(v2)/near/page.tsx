import type { Metadata } from 'next';
import { t } from '@/core/copy';
import { NearClient } from './near-client';

export const metadata: Metadata = { title: `${t('near.title')} · Styra` };

export default function NearPage() {
  return (
    <>
      <h1 className="sr-only">{t('near.title')}</h1>
      <NearClient />
    </>
  );
}

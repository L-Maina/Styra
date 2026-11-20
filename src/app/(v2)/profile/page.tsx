import { redirect } from 'next/navigation';
import { t } from '@/core/copy';
import { ButtonLink } from '@/components/v2/ui';
import { currentUser } from '@/lib/v2/session';
import { SignOutButton } from './sign-out';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const user = await currentUser();
  if (!user) redirect('/signin?next=/profile');
  return (
    <div className="mx-auto max-w-xl space-y-6 pt-4">
      <h1 className="font-sans text-[28px] font-semibold normal-case">{user.name}</h1>
      <p className="text-[17px]">{user.email}</p>
      <div className="flex flex-col gap-2">
        <ButtonLink href="/bookings" tone="secondary">{t('nav.bookings')}</ButtonLink>
        <ButtonLink href="/pro" tone="secondary">{t('welcome.forBusinesses')}</ButtonLink>
        <SignOutButton />
      </div>
    </div>
  );
}

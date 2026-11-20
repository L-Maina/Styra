import { t } from '@/core/copy';
import { AuthForm } from '@/components/v2/auth-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] normal-case font-sans">{t('auth.signInTitle')}</h1>
      <AuthForm mode="signin" next={next && next.startsWith('/') ? next : '/'} />
    </div>
  );
}

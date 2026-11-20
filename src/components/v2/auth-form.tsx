'use client';
import { useState } from 'react';
import Link from 'next/link';
import { t } from '@/core/copy';
import { FeedbackButton } from './feedback-button';
import { api, ApiFailure } from '@/lib/v2/api';

const field =
  'mt-1 block h-12 w-full rounded-2xl border border-input bg-[var(--surface-1)] px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Sign in and create account. Opaque form on the content layer; errors from the copy catalogue. */
export function AuthForm({ mode, next }: { mode: 'signin' | 'signup'; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api(mode === 'signin' ? '/auth/login' : '/auth/register', {
        body: mode === 'signin' ? { email: form.email, password: form.password } : { email: form.email, password: form.password, name: form.name, phone: form.phone || undefined },
      });
      // Full navigation so every server component reads the new session cookie.
      window.location.assign(next.startsWith('/') ? next : '/');
    } catch (err) {
      const f = err as ApiFailure;
      setError(f.message);
      setFields(f.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-2xl bg-[var(--surface-1)] px-4 py-3 text-[15px] font-semibold">
          {error}
        </p>
      )}
      {mode === 'signup' && (
        <label className="block text-[15px] font-semibold">
          {t('auth.name')}
          <input name="name" autoComplete="name" required className={field} aria-invalid={Boolean(fields.name)} />
        </label>
      )}
      <label className="block text-[15px] font-semibold">
        {t('auth.email')}
        <input name="email" type="email" inputMode="email" autoComplete="email" required className={field} aria-invalid={Boolean(fields.email)} />
      </label>
      <label className="block text-[15px] font-semibold">
        {t('auth.password')}
        <input
          name="password"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'signup' ? 10 : undefined}
          aria-describedby={mode === 'signup' ? 'pw-hint' : undefined}
          aria-invalid={Boolean(fields.password)}
          className={field}
        />
        {mode === 'signup' && (
          <span id="pw-hint" className="mt-1 block text-[13px] font-normal text-muted-foreground">
            {t('auth.passwordHint')}
          </span>
        )}
      </label>
      {mode === 'signup' && (
        <label className="block text-[15px] font-semibold">
          {t('auth.phone')}
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" className={field} />
        </label>
      )}
      <FeedbackButton type="submit" state={busy ? 'busy' : 'idle'} className="w-full min-h-[52px] text-[17px]">
        {mode === 'signin' ? t('actions.signIn') : t('actions.createAccount')}
      </FeedbackButton>
      <p className="text-center text-[15px]">
        <Link href={`${mode === 'signin' ? '/signup' : '/signin'}?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">
          {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}
        </Link>
      </p>
    </form>
  );
}

import { AppError } from '../../core/errors';

export type PayMethod = 'MPESA' | 'PAYSTACK' | 'FAKE';

/** The fake provider confirms instantly. It never runs in production unless explicitly enabled. */
export function fakePaymentsEnabled(): boolean {
  if (process.env.STYRA_FAKE_PAYMENTS === '1') return true;
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';
}

export function assertMethodAvailable(method: PayMethod): void {
  if (method === 'FAKE') {
    if (!fakePaymentsEnabled()) throw new AppError('PROVIDER_UNAVAILABLE', 'test payments are off here', 503);
    return;
  }
  // Real adapters (M-Pesa Daraja, Paystack) arrive in M4. Fail closed until they are configured.
  throw new AppError('PROVIDER_UNAVAILABLE', `${method} is not set up yet`, 503);
}

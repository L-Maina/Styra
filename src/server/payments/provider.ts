import { AppError } from '../../core/errors';
import { mpesaConfigured } from './mpesa';
import { paystackConfigured } from './paystack';

export type PayMethod = 'MPESA' | 'PAYSTACK' | 'FAKE';

/** The fake provider confirms instantly. It never runs in production unless explicitly enabled. */
export function fakePaymentsEnabled(): boolean {
  if (process.env.STYRA_FAKE_PAYMENTS === '1') return true;
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';
}

/** Methods this deployment can take right now. Production with none configured takes none (fail closed). */
export function availableMethods(): PayMethod[] {
  const out: PayMethod[] = [];
  if (mpesaConfigured()) out.push('MPESA');
  if (paystackConfigured()) out.push('PAYSTACK');
  if (fakePaymentsEnabled()) out.push('FAKE');
  return out;
}

export function assertMethodAvailable(method: PayMethod): void {
  if (!availableMethods().includes(method)) throw new AppError('PROVIDER_UNAVAILABLE', `${method} is not available here`, 503);
}

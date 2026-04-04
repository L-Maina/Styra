import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

const ENV_VARS = [
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_SECRET',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_BUSINESS_SHORTCODE',
  'MPESA_ONLINE_PASSKEY',
  'MPESA_CALLBACK_URL',
  'RESEND_API_KEY',
  'REDIS_URL',
];

// Check which production env vars are configured (names only, no values exposed)
export async function GET() {
  try {
    await requireAdmin();

    const status: Record<string, boolean> = {};
    for (const name of ENV_VARS) {
      status[name] = !!process.env[name];
    }

    return successResponse(status);
  } catch (error) {
    return handleApiError(error);
  }
}

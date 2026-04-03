// SMS notification service — Africa's Talking (with dev fallback)

// ── Types ───────────────────────────────────────────────────────────────

interface SMSOptions {
  to: string;
  message: string;
}

interface AfricaTalkingResponse {
  SMSMessageData?: {
    Recipients?: Array<{
      number: string;
      status: string;
      cost: string;
      messageId: string;
    }>;
    Message?: string;
  };
}

// ── Africa's Talking API ───────────────────────────────────────────────

const AFRICASTALKING_API_URL = 'https://api.africastalking.com/v1/messaging';

function getCredentials(): { username: string; apiKey: string } | null {
  const username = process.env.AFRICAS_TALKING_USERNAME || '';
  const apiKey = process.env.AFRICAS_TALKING_API_KEY || '';
  if (!username || !apiKey) return null;
  return { username, apiKey };
}

function isConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Send SMS via Africa's Talking API.
 *
 * - Development: logs to console and returns true if credentials are missing.
 * - Production: calls Africa's Talking API. Returns false on failure (never throws).
 */
export async function sendSMS(options: SMSOptions): Promise<boolean> {
  const { to, message } = options;

  // ── Dev fallback ────────────────────────────────────────────────────
  if (!isConfigured()) {
    console.log('[SMS] ⚠️  Africa\'s Talking not configured (missing AFRICAS_TALKING_USERNAME or AFRICAS_TALKING_API_KEY)');
    console.log('[SMS] Mock delivery:', {
      to,
      message: message.substring(0, 80) + (message.length > 80 ? '…' : ''),
    });
    return true; // pretend success in dev
  }

  // ── Production: call Africa's Talking ──────────────────────────────
  const credentials = getCredentials()!; // guaranteed non-null above
  const { username, apiKey } = credentials;

  const auth = Buffer.from(`${username}:${apiKey}`).toString('base64');

  try {
    const response = await fetch(AFRICASTALKING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username,
        to: [to],
        message,
        from: username, // Africa's Talking uses the registered username as sender ID
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[SMS] Africa\'s Talking API error:', {
        status: response.status,
        statusText: response.statusText,
        body: body.substring(0, 200),
      });
      return false;
    }

    const data: AfricaTalkingResponse = await response.json().catch(() => ({}));

    const recipient = data.SMSMessageData?.Recipients?.[0];
    if (recipient?.status === 'Success') {
      return true;
    }

    // Log non-success statuses but don't throw
    console.error('[SMS] Africa\'s Talking delivery issue:', {
      to,
      status: recipient?.status || 'unknown',
      statusCode: recipient ? (recipient as Record<string, unknown>).statusCode : undefined,
    });
    return false;
  } catch (error) {
    // Never throw — return false on any network/parse error
    console.error('[SMS] Failed to send SMS:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// ── Convenience wrappers ───────────────────────────────────────────────

/** Send an OTP code to a phone number. */
export async function sendOTP(phone: string, otp: string): Promise<boolean> {
  const message = `Your Styra verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  return sendSMS({ to: phone, message });
}

/** Send a booking confirmation SMS. */
export async function sendBookingConfirmationSMS(
  phone: string,
  data: { businessName: string; date: string; time: string },
): Promise<boolean> {
  const message = `Styra: Your appointment at ${data.businessName} is confirmed for ${data.date} at ${data.time}. Thank you!`;
  return sendSMS({ to: phone, message });
}

/** Send an appointment reminder SMS. */
export async function sendAppointmentReminderSMS(
  phone: string,
  data: { businessName: string; time: string },
): Promise<boolean> {
  const message = `Styra Reminder: You have an appointment at ${data.businessName} tomorrow at ${data.time}. See you soon!`;
  return sendSMS({ to: phone, message });
}

/** Send a booking cancellation SMS. */
export async function sendBookingCancellationSMS(
  phone: string,
  data: { businessName: string; date: string },
): Promise<boolean> {
  const message = `Styra: Your appointment at ${data.businessName} on ${data.date} has been cancelled.`;
  return sendSMS({ to: phone, message });
}

/** Send a payment confirmation SMS. */
export async function sendPaymentConfirmationSMS(
  phone: string,
  data: { amount: string; businessName: string },
): Promise<boolean> {
  const message = `Styra: Payment of ${data.amount} to ${data.businessName} confirmed. Thank you!`;
  return sendSMS({ to: phone, message });
}

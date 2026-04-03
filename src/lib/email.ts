// Email notification service
// In production, use services like SendGrid, AWS SES, Resend, or Nodemailer

import { env } from '@/lib/env';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email templates
export const emailTemplates = {
  welcome: (name: string): EmailTemplate => ({
    subject: 'Welcome to Styra!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Welcome to Styra!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for joining Styra, the premier grooming marketplace.</p>
        <p>With Styra, you can:</p>
        <ul>
          <li>Discover top-rated grooming services near you</li>
          <li>Book appointments with skilled professionals</li>
          <li>Read and write reviews</li>
          <li>Enjoy secure payments</li>
        </ul>
        <p>Get started by exploring businesses in your area!</p>
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Welcome to Styra! Hi ${name}, Thank you for joining Styra, the premier grooming marketplace.`,
  }),

  bookingConfirmation: (data: {
    customerName: string;
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
    amount: number;
    currency: string;
  }): EmailTemplate => ({
    subject: 'Booking Confirmed - Styra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Booking Confirmed!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Business:</strong> ${data.businessName}</p>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
        </div>
        <p>Please arrive 5 minutes before your appointment.</p>
        <p>Need to cancel? You can do so from your dashboard up to 24 hours before your appointment.</p>
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Booking Confirmed! Business: ${data.businessName}, Service: ${data.serviceName}, Date: ${data.date}, Time: ${data.time}`,
  }),

  bookingReminder: (data: {
    customerName: string;
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
  }): EmailTemplate => ({
    subject: 'Appointment Reminder - Tomorrow',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Appointment Reminder</h1>
        <p>Hi ${data.customerName},</p>
        <p>This is a friendly reminder about your appointment tomorrow:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Business:</strong> ${data.businessName}</p>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
        </div>
        <p>See you soon!</p>
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Appointment Reminder: ${data.businessName} on ${data.date} at ${data.time}`,
  }),

  paymentReceipt: (data: {
    customerName: string;
    businessName: string;
    serviceName: string;
    amount: number;
    currency: string;
    transactionId: string;
    date: string;
  }): EmailTemplate => ({
    subject: 'Payment Receipt - Styra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Payment Receipt</h1>
        <p>Hi ${data.customerName},</p>
        <p>Thank you for your payment. Here's your receipt:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Business:</strong> ${data.businessName}</p>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
          <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
          <p><strong>Date:</strong> ${data.date}</p>
        </div>
        <p>Thank you for using Styra!</p>
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Payment Receipt: ${data.currency} ${data.amount} to ${data.businessName}`,
  }),

  verificationUpdate: (data: {
    ownerName: string;
    businessName: string;
    status: string;
    reason?: string;
  }): EmailTemplate => ({
    subject: `Business Verification Update - ${data.status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Verification Update</h1>
        <p>Hi ${data.ownerName},</p>
        <p>Your business "${data.businessName}" verification status has been updated.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Status:</strong> ${data.status}</p>
          ${data.reason ? `<p><strong>Notes:</strong> ${data.reason}</p>` : ''}
        </div>
        ${data.status === 'APPROVED' ? '<p>Congratulations! Your business is now visible to customers.</p>' : ''}
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Verification Update: Your business "${data.businessName}" is now ${data.status}`,
  }),

  resetPassword: (data: { name: string; resetUrl: string }): EmailTemplate => ({
    subject: 'Reset Your Password - Styra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6C4EFF;">Reset Your Password</h1>
        <p>Hi ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${data.resetUrl}" style="display: inline-block; background: #6C4EFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
          Reset Password
        </a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The Styra Team</p>
      </div>
    `,
    text: `Reset your password: ${data.resetUrl}`,
  }),

  emailVerification: (name: string, verificationUrl: string): EmailTemplate => ({
    subject: 'Verify Your Email - Styra',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #059669;">Verify Your Email Address</h1>
        <p>Hi ${name},</p>
        <p>Thank you for signing up with Styra!</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${verificationUrl}" style="color: #059669; word-break: break-all;">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px;">
          This link will expire in 30 minutes. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `,
    text: `Verify your email: ${verificationUrl}`,
  }),
};

// Send email function — Resend API integration with environment-aware fallback
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = env.email.apiKey;

  if (!apiKey) {
    if (env.features.devPaymentFallback) {
      // Dev mode only: log to console
      console.log('[EMAIL - DEV MODE]', {
        to: options.to,
        subject: options.subject,
      });
      console.log('[EMAIL - DEV MODE] HTML preview:', options.html?.substring(0, 200));
      return true;
    }
    // Production: email is REQUIRED
    console.error('[EMAIL] RESEND_API_KEY not configured. Email delivery is disabled.');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Styra <noreply@styra.app>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[EMAIL] Resend API error:', response.status, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error);
    return false;
  }
}

// Convenience functions
export async function sendWelcomeEmail(email: string, name: string) {
  const template = emailTemplates.welcome(name);
  return sendEmail({ to: email, ...template });
}

export async function sendBookingConfirmation(email: string, data: Parameters<typeof emailTemplates.bookingConfirmation>[0]) {
  const template = emailTemplates.bookingConfirmation(data);
  return sendEmail({ to: email, ...template });
}

export async function sendBookingReminder(email: string, data: Parameters<typeof emailTemplates.bookingReminder>[0]) {
  const template = emailTemplates.bookingReminder(data);
  return sendEmail({ to: email, ...template });
}

export async function sendPaymentReceipt(email: string, data: Parameters<typeof emailTemplates.paymentReceipt>[0]) {
  const template = emailTemplates.paymentReceipt(data);
  return sendEmail({ to: email, ...template });
}

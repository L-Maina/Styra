'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, CheckCircle, Loader2, Eye, EyeOff, KeyRound, AlertCircle, ExternalLink } from 'lucide-react';
import { GlassButton, GlassCard } from '@/components/ui/custom/glass-components';
import api from '@/lib/api-client';
import { toast } from 'sonner';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  // Inline reset state (used when email is not configured)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      const data = res.data as Record<string, unknown> | undefined;

      if (data && data.emailSent === false && data.resetUrl) {
        // Email not configured — extract token and show inline reset
        setEmailConfigured(false);
        setResetUrl(data.resetUrl as string);
        try {
          const url = new URL(data.resetUrl as string);
          const token = url.searchParams.get('token');
          if (token) setResetToken(token);
        } catch {
          // If URL parsing fails, still show the link
        }
        setIsSent(true);
        toast.info('Email service not configured — you can reset below');
      } else {
        // Email sent (or dev mode where sendEmail returned true)
        setEmailConfigured(true);
        setIsSent(true);
        toast.success('Password reset link sent to your email');
      }
    } catch (err: any) {
      // Still show success even if error (prevents email enumeration)
      setEmailConfigured(null);
      setIsSent(true);
      toast.success('If an account exists with that email, a reset link has been sent.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInlineReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one number');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      toast.error('Password must contain at least one special character');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      await api.resetPassword(resetToken, newPassword);
      setResetDone(true);
      toast.success('Password reset successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </button>

        <GlassCard className="p-8" hover={false}>
          {resetDone ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Password Reset!</h1>
              <p className="text-muted-foreground mb-6">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <GlassButton variant="primary" className="w-full" onClick={onBack}>
                Back to Sign In
              </GlassButton>
            </div>
          ) : isSent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>

              {emailConfigured === false && resetToken ? (
                // Email NOT configured — show inline reset form
                <>
                  <h1 className="text-2xl font-bold mb-2">Reset Your Password</h1>
                  <p className="text-muted-foreground mb-5">
                    Email delivery is not configured yet. You can reset your password directly below.
                  </p>

                  {/* Inline reset form */}
                  <form onSubmit={handleInlineReset} className="space-y-4 text-left">
                    <div className="relative">
                      <label className="text-sm font-medium mb-2 block">New Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 chars, upper, lower, number, special"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          disabled={isResetting}
                          className="w-full h-11 px-4 pr-10 rounded-lg border border-input bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {/* Password strength hints */}
                      {newPassword.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {[
                            { test: newPassword.length >= 8, label: 'At least 8 characters' },
                            { test: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                            { test: /[a-z]/.test(newPassword), label: 'Lowercase letter' },
                            { test: /[0-9]/.test(newPassword), label: 'Number' },
                            { test: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword), label: 'Special character' },
                          ].map(({ test, label }) => (
                            <div key={label} className="flex items-center gap-1.5 text-xs">
                              <div className={`w-1.5 h-1.5 rounded-full ${test ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                              <span className={test ? 'text-green-600' : 'text-muted-foreground'}>{label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Confirm Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isResetting}
                        className="w-full h-11 px-4 rounded-lg border border-input bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                      {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>
                    <GlassButton
                      type="submit"
                      variant="primary"
                      className="w-full h-12"
                      disabled={isResetting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Reset Password
                        </>
                      )}
                    </GlassButton>
                  </form>
                </>
              ) : (
                // Email sent (or status unknown)
                <>
                  <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-muted-foreground mb-1">
                    We&apos;ve sent a password reset link to
                  </p>
                  <p className="font-medium text-foreground mb-1">{email}</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    The link will expire in 1 hour.
                  </p>

                  <div className="bg-muted/50 rounded-lg p-3 mb-6 text-left">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Didn&apos;t receive it? Check your spam or junk folder.</p>
                        <p>The email comes from <span className="font-medium">noreply@styra.app</span></p>
                      </div>
                    </div>
                  </div>

                  {resetUrl && emailConfigured === null && (
                    <div className="mb-6">
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">or reset directly</span>
                        </div>
                      </div>
                      <a
                        href={resetUrl}
                        className="flex items-center gap-2 justify-center px-4 py-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Reset Link
                      </a>
                    </div>
                  )}

                  <div className="space-y-3">
                    <GlassButton variant="primary" className="w-full" onClick={onBack}>
                      Back to Sign In
                    </GlassButton>
                    <button
                      onClick={() => { setIsSent(false); setEmailConfigured(null); setResetUrl(null); setResetToken(null); }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                    >
                      Try a different email address
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Forgot Password?</h1>
                <p className="text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  className="w-full h-12"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </GlassButton>
              </form>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

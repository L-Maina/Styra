'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, CheckCircle, Loader2, Link, Eye, EyeOff, KeyRound } from 'lucide-react';
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
        setResetUrl(data.resetUrl as string);
        const url = new URL(data.resetUrl as string);
        const token = url.searchParams.get('token');
        if (token) setResetToken(token);
        setIsSent(true);
        toast.info('Email not configured — use the reset link below');
      } else {
        // Email sent successfully
        setIsSent(true);
        toast.success('Password reset link sent to your email');
      }
    } catch (err: any) {
      // Still show success even if error (prevents email enumeration)
      toast.error(err.message || 'Failed to send reset link. Please try again.');
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

              {resetUrl ? (
                // Dev mode: email not configured
                <>
                  <h1 className="text-2xl font-bold mb-2">Reset Link Generated</h1>
                  <p className="text-muted-foreground mb-4">
                    Email is not configured. Use the link below to reset your password.
                  </p>

                  {/* Clickable reset link */}
                  <a
                    href={resetUrl}
                    className="flex items-center gap-2 justify-center px-4 py-3 mb-4 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    <Link className="h-4 w-4" />
                    Open Reset Link
                  </a>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or reset inline</span>
                    </div>
                  </div>

                  {/* Inline reset form */}
                  <form onSubmit={handleInlineReset} className="space-y-4 text-left">
                    <div className="relative">
                      <label className="text-sm font-medium mb-2 block">New Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 characters"
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
                    </div>
                    <GlassButton
                      type="submit"
                      variant="primary"
                      className="w-full h-12"
                      disabled={isResetting || !newPassword || !confirmPassword}
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
                // Email sent mode
                <>
                  <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
                  <p className="text-muted-foreground mb-6">
                    We&apos;ve sent a password reset link to <span className="font-medium text-foreground">{email}</span>. 
                    The link will expire in 1 hour.
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Didn&apos;t receive the email? Check your spam folder or{' '}
                    <button onClick={() => { setIsSent(false); setResetUrl(null); setResetToken(null); }} className="text-primary hover:underline">
                      try again
                    </button>.
                  </p>
                  <GlassButton variant="primary" className="w-full" onClick={onBack}>
                    Back to Sign In
                  </GlassButton>
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

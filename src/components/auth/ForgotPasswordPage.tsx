'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, CheckCircle, Loader2 } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setIsSent(true);
      toast.success('Password reset link sent to your email');
    } catch (err: any) {
      // Still show success even if error (prevents email enumeration)
      toast.error(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
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
          {isSent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
              <p className="text-muted-foreground mb-6">
                We&apos;ve sent a password reset link to <span className="font-medium text-foreground">{email}</span>. 
                The link will expire in 10 minutes.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button onClick={() => setIsSent(false)} className="text-primary hover:underline">
                  try again
                </button>.
              </p>
              <GlassButton variant="primary" className="w-full" onClick={onBack}>
                Back to Sign In
              </GlassButton>
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

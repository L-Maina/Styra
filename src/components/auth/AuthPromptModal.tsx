'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogIn, UserPlus } from 'lucide-react';
import { GlassCard, GlassButton } from '@/components/ui/custom/glass-components';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'book' | 'favorite' | 'message' | 'review' | 'block' | 'report' | 'support' | 'dashboard';
  onSignIn: () => void;
  onSignUp: () => void;
}

const actionMessages: Record<AuthPromptModalProps['action'], { title: string; description: string }> = {
  book: {
    title: 'Sign in to Book',
    description: 'Create an account or sign in to book this service.',
  },
  favorite: {
    title: 'Sign in to Save',
    description: 'Create an account or sign in to save this business to your favorites.',
  },
  message: {
    title: 'Sign in to Message',
    description: 'Create an account or sign in to send a message to this business.',
  },
  review: {
    title: 'Sign in to Review',
    description: 'Create an account or sign in to leave a review.',
  },
  block: {
    title: 'Sign in to Block',
    description: 'Create an account or sign in to block this user.',
  },
  report: {
    title: 'Sign in to Report',
    description: 'Create an account or sign in to report this user or business.',
  },
  support: {
    title: 'Sign in for Support',
    description: 'Create an account or sign in to submit a support request.',
  },
  dashboard: {
    title: 'Sign in to Continue',
    description: 'Create an account or sign in to access your dashboard.',
  },
};

export const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  isOpen,
  onClose,
  action,
  onSignIn,
  onSignUp,
}) => {
  const { title, description } = actionMessages[action];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <GlassCard variant="elevated" className="w-full max-w-md p-6 relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Content */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <LogIn className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2">{title}</h2>
                <p className="text-muted-foreground">{description}</p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <GlassButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={onSignIn}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </GlassButton>

                <GlassButton
                  variant="default"
                  size="lg"
                  className="w-full"
                  onClick={onSignUp}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </GlassButton>
              </div>

              {/* Note */}
              <p className="text-center text-xs text-muted-foreground mt-4">
                You can switch between Client and Provider modes after signing in.
              </p>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AuthPromptModal;

'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================
// GLASS CARD — Premium Liquid Glass
// ============================================

interface GlassCardProps {
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient';
  hover?: boolean;
  glow?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', hover = true, glow = false, children, onClick }, ref) => {
    const variantStyles: Record<string, string> = {
      default: 'glass-card',
      elevated: 'glass-card shadow-glow-sm',
      bordered: 'glass-card',
      gradient: 'glass-card gradient-border',
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          variantStyles[variant],
          glow && 'shadow-glow',
          'p-6 text-foreground',
          variant === 'bordered' && 'border border-[rgba(255,255,255,0.15)]',
          className
        )}
        whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = 'GlassCard';

// ============================================
// GLASS BUTTON — Premium with glow
// ============================================

interface GlassButtonProps {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export const GlassButton: React.FC<GlassButtonProps & React.RefAttributes<HTMLButtonElement>> = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    isLoading = false,
    leftIcon,
    rightIcon,
    children, 
    disabled,
    onClick,
    type = 'button',
    title,
  }, ref) => {
    const variants: Record<string, string> = {
      default: cn(
        'glass-button',
        'hover:shadow-glow-sm',
        'text-foreground'
      ),
      primary: cn(
        'gradient-bg text-white shadow-glow-sm',
        'relative overflow-hidden',
      ),
      secondary: cn(
        'glass-button',
        'hover:shadow-glow-sm',
        'text-foreground'
      ),
      outline: cn(
        'glass-button',
        'hover:border-[rgba(108,78,255,0.5)] hover:shadow-glow-sm hover:bg-[rgba(108,78,255,0.1)]',
        'border border-[rgba(255,255,255,0.15)]',
        'text-foreground'
      ),
      ghost: cn(
        'bg-transparent',
        'hover:bg-[rgba(255,255,255,0.06)] hover:shadow-sm',
        'text-foreground'
      ),
    };

    const sizes: Record<string, string> = {
      sm: 'h-9 px-4 text-sm rounded-xl',
      md: 'h-11 px-5 text-sm rounded-xl',
      lg: 'h-12 px-7 text-base rounded-2xl',
      icon: 'h-10 w-10 p-0 rounded-xl',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        title={title}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          'disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          className
        )}
        whileHover={disabled || isLoading ? undefined : { scale: 1.03 }}
        whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
        disabled={disabled || isLoading}
        onClick={(e) => onClick?.(e)}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </motion.button>
    );
  }
);
GlassButton.displayName = 'GlassButton';

// ============================================
// GLASS INPUT — Premium translucent
// ============================================

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/70 pointer-events-none z-10">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-[rgba(255,255,255,0.08)] backdrop-blur-sm',
            'px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60',
            'transition-[box-shadow,border-color] duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'disabled:cursor-not-allowed disabled:opacity-40',
            'border-[rgba(255,255,255,0.15)]',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-destructive/60 focus:ring-destructive/30',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/70 pointer-events-none z-10">
            {rightIcon}
          </div>
        )}
        {error && (
          <p className="text-xs text-destructive/80 mt-1.5 pl-1">{error}</p>
        )}
      </div>
    );
  }
);
GlassInput.displayName = 'GlassInput';

// ============================================
// GLASS MODAL — Premium with reflections
// ============================================

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}) => {
  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'relative w-full glass-modal rounded-2xl p-6 text-foreground',
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 hover:bg-white/10 transition-colors duration-200 text-muted-foreground hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Header */}
        {(title || description) && (
          <div className="mb-5 pr-8">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// GLASS BADGE — Premium subtle
// ============================================

interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants: Record<string, string> = {
    default: 'bg-white/10 text-foreground',
    primary: 'bg-primary/20 text-primary-light',
    secondary: 'bg-secondary/20 text-secondary-light',
    success: 'bg-green-500/15 text-green-400',
    warning: 'bg-yellow-500/15 text-yellow-400',
    destructive: 'bg-red-500/15 text-red-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        'backdrop-blur-sm border border-white/5',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

// ============================================
// GRADIENT TEXT — Signature logo gradient
// ============================================

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const GradientText: React.FC<GradientTextProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <span className={cn('gradient-text', className)} {...props}>
      {children}
    </span>
  );
};

// ============================================
// SKELETON — Premium shimmer
// ============================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  ...props
}) => {
  const variants: Record<string, string> = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return (
    <div
      className={cn('skeleton', variants[variant], className)}
      {...props}
    />
  );
};

// ============================================
// FADE IN — Smooth fluid motion
// ============================================

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 0.5,
  direction = 'up',
  className,
  ...props
}) => {
  const directions: Record<string, { x?: number; y?: number }> = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
    none: {},
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: 'easeInOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// ============================================
// STAGGER CHILDREN
// ============================================

interface StaggerChildrenProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number;
}

export const StaggerChildren: React.FC<StaggerChildrenProps> = ({
  children,
  staggerDelay = 0.1,
  className,
  ...props
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<HTMLMotionProps<'div'>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

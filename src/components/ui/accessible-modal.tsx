'use client';

import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

type AccessibleModalSize = 'sm' | 'default' | 'lg' | 'xl' | 'full';

interface AccessibleModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Optional description */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Size variant */
  size?: AccessibleModalSize;
  /** Additional content class */
  className?: string;
}

const sizeClasses: Record<AccessibleModalSize, string> = {
  sm: 'max-w-sm',
  default: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-4rem)]',
};

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'default',
  className,
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { activate, deactivate } = useFocusTrap(modalRef, {
    restoreFocus: true,
    clickOutsideDeactivates: true,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Store trigger and activate trap on open
  useEffect(() => {
    if (isOpen) {
      // Save currently focused element
      triggerRef.current = document.activeElement as HTMLElement;

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Add escape handler
      document.addEventListener('keydown', handleKeyDown, true);

      // Activate focus trap after render
      const timer = setTimeout(() => {
        activate();
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown, true);
        deactivate();

        // Restore focus
        triggerRef.current?.focus();
      };
    }
  }, [isOpen, activate, deactivate, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessible-modal-title"
        aria-describedby={description ? 'accessible-modal-desc' : undefined}
        className={cn(
          'relative z-10 w-full rounded-2xl bg-background p-6 shadow-2xl',
          'glass-modal animate-in fade-in zoom-in-95',
          sizeClasses[size],
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close dialog"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {/* Title */}
        <h2
          id="accessible-modal-title"
          className="text-lg font-semibold leading-none pr-8"
        >
          {title}
        </h2>

        {/* Description */}
        {description && (
          <p
            id="accessible-modal-desc"
            className="mt-2 text-sm text-muted-foreground"
          >
            {description}
          </p>
        )}

        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

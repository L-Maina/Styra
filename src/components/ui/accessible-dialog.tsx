'use client';

import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  type ReactNode,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogClose,
} from '@/components/ui/dialog';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

type AccessibleDialogSize = 'sm' | 'default' | 'lg' | 'xl' | 'full';

interface AccessibleDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Optional description */
  description?: string;
  /** Dialog content */
  children: ReactNode;
  /** Size variant */
  size?: AccessibleDialogSize;
  /** If true, the dialog cannot be dismissed by clicking outside or pressing Escape */
  preventClose?: boolean;
  /** Additional content class */
  className?: string;
}

const sizeClasses: Record<AccessibleDialogSize, string> = {
  sm: 'sm:max-w-sm',
  default: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-[calc(100vw-4rem)] sm:max-h-[calc(100vh-4rem)]',
};

const AccessibleDialog = forwardRef<HTMLDivElement, AccessibleDialogProps>(
  function AccessibleDialog(
    {
      open,
      onOpenChange,
      title,
      description,
      children,
      size = 'default',
      preventClose = false,
      className,
    },
    _ref
  ) {
    const contentRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const { activate, deactivate } = useFocusTrap(contentRef, {
      restoreFocus: true,
    });

    // Store the trigger element before opening
    const handleOpenChange = useCallback(
      (isOpen: boolean) => {
        if (preventClose && !isOpen) return;
        if (isOpen) {
          triggerRef.current = document.activeElement as HTMLElement;
        }
        onOpenChange(isOpen);
      },
      [onOpenChange, preventClose]
    );

    // Activate/deactivate focus trap
    useEffect(() => {
      if (open) {
        // Delay to allow Radix portal to render
        const timer = setTimeout(() => {
          activate();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        deactivate();
      }
    }, [open, activate, deactivate]);

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent
            ref={contentRef}
            className={cn(sizeClasses[size], className)}
            aria-describedby={description ? 'accessible-dialog-desc' : undefined}
            aria-modal="true"
            showCloseButton={!preventClose}
            onPointerDownOutside={
              preventClose
                ? (e) => e.preventDefault()
                : undefined
            }
            onEscapeKeyDown={
              preventClose
                ? (e) => e.preventDefault()
                : undefined
            }
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription id="accessible-dialog-desc">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>
            {children}
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );
  }
);

export { AccessibleDialog };
export type { AccessibleDialogProps, AccessibleDialogSize };

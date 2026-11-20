import { cn } from '@/lib/utils';
import type { ElementType, ComponentProps } from 'react';

type GlassProps<T extends ElementType> = {
  as?: T;
  /** regular: anything with text. clear: only over photos, icons and large text, with a scrim behind. */
  level?: 'regular' | 'clear';
} & Omit<ComponentProps<T>, 'as'>;

/**
 * The only way to put glass on screen (design-language.md section 4). Functional layer only:
 * bars, sheets, menus, floating controls, toasts. Never content, never money, never glass on glass.
 */
export function Glass<T extends ElementType = 'div'>({ as, level = 'regular', className, ...rest }: GlassProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return <Tag className={cn('glass', level === 'clear' && 'glass-clear', className)} {...rest} />;
}

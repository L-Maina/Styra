'use client';

import { forwardRef } from 'react';
import { BRAND_NAME, LOGO_ASPECT, LOGO_SIZES, logoSrc, type LogoVariant } from '@/lib/brand';

// ============================================
// BrandLogo: the Styra logo from the identity kit
// ============================================
// The kit draws every logo twice, for an ivory ground and for a graphite ground. Both are rendered and
// globals.css shows the one that matches the theme (graphite is the default, .light switches to ivory),
// so there is no flash and no theme lookup in JavaScript. The hidden copy is display:none, so screen
// readers only meet one image. All logo rendering goes through this component.

export type { LogoVariant };

export interface BrandLogoProps {
  /** Which logo to show. 'full' is the primary logo: symbol and wordmark side by side. */
  variant?: LogoVariant;
  /** Preset size context, or a custom height in pixels */
  size?: keyof typeof LOGO_SIZES | number;
  /** Additional CSS classes, applied to the wrapper */
  className?: string;
  /** Click handler (e.g., navigate home) */
  onClick?: () => void;
  /** Whether to add hover effect */
  hoverable?: boolean;
  /** Whether to add loading animation (pulse) */
  animated?: boolean;
  /** Alt text override. Use '' when the name is already shown nearby. */
  alt?: string;
}

function resolveHeight(size: keyof typeof LOGO_SIZES | number): number {
  if (typeof size === 'number') return size;
  return LOGO_SIZES[size].height;
}

export const BrandLogo = forwardRef<HTMLSpanElement, BrandLogoProps>(function BrandLogo(
  {
    variant = 'full',
    size = 'navbarDesktop',
    className = '',
    onClick,
    hoverable = false,
    animated = false,
    alt = BRAND_NAME,
  },
  ref
) {
  const height = resolveHeight(size);
  const width = Math.round(height * LOGO_ASPECT[variant] * 100) / 100;

  const image = (theme: 'light' | 'dark') => (
    <img
      src={logoSrc(variant, theme)}
      alt={alt}
      width={width}
      height={height}
      draggable={false}
      decoding="async"
      className={`brand-logo__img brand-logo__img--${theme} block object-contain`}
      style={{ width, height }}
    />
  );

  return (
    <span
      ref={ref}
      onClick={onClick}
      className={[
        'inline-flex shrink-0 select-none pointer-events-none',
        hoverable && 'pointer-events-auto cursor-pointer transition-opacity duration-200 hover:opacity-80',
        animated && 'animate-pulse',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {image('light')}
      {image('dark')}
    </span>
  );
});

BrandLogo.displayName = 'BrandLogo';

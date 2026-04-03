'use client';

import { forwardRef } from 'react';
import { BRAND, LOGO_SIZES, BRAND_NAME } from '@/lib/brand';

// ============================================
// BrandLogo — Reusable logo component
// ============================================
// Renders the correct Styra logo variant at the right size.
// All logo rendering should go through this component.

export type LogoVariant = 'full' | 'icon' | 'monogram' | 'wordmark';

export interface BrandLogoProps {
  /** Which logo to show */
  variant?: LogoVariant;
  /** Preset size context, or custom height in pixels */
  size?: keyof typeof LOGO_SIZES | number;
  /** Additional CSS classes */
  className?: string;
  /** Click handler (e.g., navigate home) */
  onClick?: () => void;
  /** Whether to add hover effect */
  hoverable?: boolean;
  /** Whether to add loading animation (pulse) */
  animated?: boolean;
  /** Alt text override */
  alt?: string;
}

const variantToSrc: Record<LogoVariant, string> = {
  full: BRAND.logoFull,
  icon: BRAND.logoIcon,
  monogram: BRAND.logoMonogram,
  wordmark: BRAND.logoWordmark,
};

function resolveHeight(size: keyof typeof LOGO_SIZES | number): number {
  if (typeof size === 'number') return size;
  return LOGO_SIZES[size].height;
}

export const BrandLogo = forwardRef<HTMLImageElement, BrandLogoProps>(
  function BrandLogo(
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
    const isSquare = variant === 'icon';
    const width = isSquare ? height : undefined;

    return (
      <img
        ref={ref}
        src={variantToSrc[variant]}
        alt={alt}
        height={height}
        width={width}
        draggable={false}
        decoding="async"
        className={[
          // Base
          'object-contain',
          'select-none',
          'pointer-events-none',
          // Hover
          hoverable && 'pointer-events-auto cursor-pointer transition-opacity duration-200 hover:opacity-80',
          // Animation
          animated && 'animate-pulse',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        style={width ? { height, width } : { height }}
      />
    );
  }
);

BrandLogo.displayName = 'BrandLogo';

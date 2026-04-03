// ============================================
// STYRA BRAND ASSET CONFIGURATION
// ============================================
// Central source of truth for all brand asset paths.
// All components should import from here to ensure consistency.

/**
 * Brand asset paths — all served from /public/assets/branding/
 *
 * Asset mapping:
 *   logo-full.png    → Full logo (icon + "Styra" text) for headers, auth pages
 *   logo-icon.png    → Square icon for compact UI (mobile nav, loading, push notifications)
 *   logo-monogram.png → Monogram "S" for dashboards, sidebar, badges
 *   logo-wordmark.png → Text-only "Styra" for footers, inline branding
 *   favicon-source.png → High-res source for favicons
 */

export const BRAND = {
  // Primary logo — icon + wordmark combined
  logoFull: '/assets/branding/logo-full.png',
  // Square icon (for mobile, notifications, loading states)
  logoIcon: '/assets/branding/logo-icon.png',
  // Monogram "S" (for compact/dark contexts)
  logoMonogram: '/assets/branding/logo-monogram.png',
  // Wordmark only (for footers, inline use)
  logoWordmark: '/assets/branding/logo-wordmark.png',
  // Favicon source
  favicon: '/assets/branding/favicon-source.png',
  // OG Image
  ogImage: '/assets/branding/logo-full.png',
} as const;

/** Logo display sizes (in pixels) for different contexts */
export const LOGO_SIZES = {
  /** Navbar desktop */
  navbarDesktop: { height: 36, width: 'auto' as const },
  /** Navbar mobile */
  navbarMobile: { height: 28, width: 'auto' as const },
  /** Auth page (login/register) */
  authPage: { height: 56, width: 'auto' as const },
  /** Dashboard sidebar compact */
  dashboardCompact: { height: 28, width: 'auto' as const },
  /** Dashboard expanded */
  dashboardExpanded: { height: 36, width: 'auto' as const },
  /** Loading state */
  loading: { height: 48, width: 48 },
  /** Footer */
  footer: { height: 32, width: 'auto' as const },
  /** Push notification icon */
  notification: { height: 192, width: 192 },
} as const;

/** Brand name for alt text / aria labels */
export const BRAND_NAME = 'Styra';

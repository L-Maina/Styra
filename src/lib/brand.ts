// ============================================
// STYRA BRAND ASSET CONFIGURATION
// ============================================
// Central source of truth for all brand asset paths.
// All components should import from here to ensure consistency.

/**
 * Brand asset paths — all served from /public/assets/branding/
 *
 * Asset mapping (the UI uses the small `-sm` copies, 180 px tall, enough for 3x phone screens;
 * the full-size originals stay as the source files):
 *   logo-full-sm.png    → Full logo (icon + "Styra" text) for headers, auth pages
 *   logo-icon-sm.png    → Square icon for compact UI (mobile nav, loading, push notifications)
 *   logo-monogram-sm.png → Monogram "S" for dashboards, sidebar, badges
 *   logo-wordmark-sm.png → Text-only "Styra" for footers, inline branding
 *   favicon-source.png  → High-res source for favicons
 * App icons live in /public/icons, the share image is /public/og-image.png.
 */

export const BRAND = {
  // Primary logo — icon + wordmark combined
  logoFull: '/assets/branding/logo-full-sm.png',
  // Square icon (for mobile, notifications, loading states)
  logoIcon: '/assets/branding/logo-icon-sm.png',
  // Monogram "S" (for compact/dark contexts)
  logoMonogram: '/assets/branding/logo-monogram-sm.png',
  // Wordmark only (for footers, inline use)
  logoWordmark: '/assets/branding/logo-wordmark-sm.png',
  // Favicon source
  favicon: '/assets/branding/favicon-source.png',
  // OG Image
  ogImage: '/og-image.png',
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

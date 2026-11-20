// ============================================
// STYRA BRAND CONFIGURATION
// ============================================
// The identity kit (concept A, "Signature") is the source of truth: brand/ on the brand/identity-kit branch.
// The web copies of the logos are in public/brand/logo, colours are in src/app/globals.css and the fonts
// (Syne for display, Manrope for text) are loaded in src/app/layout.tsx.

export type LogoVariant = 'full' | 'stacked' | 'icon' | 'monogram' | 'wordmark';
export type LogoTheme = 'light' | 'dark';

/** The kit lockup each variant uses. */
export const LOGO_FILES: Record<LogoVariant, string> = {
  full: 'horizontal', // symbol + wordmark, the primary logo: headers, auth, footers
  stacked: 'stacked', // symbol above the wordmark, for square and narrow spaces
  icon: 'symbol', // the mark alone, where the name is already nearby
  monogram: 'monogram', // heavier drawing of the mark for 16 to 48 px
  wordmark: 'wordmark', // STYRA alone
};

/** Width divided by height of each logo, from its SVG viewBox. A test keeps these equal to the files. */
export const LOGO_ASPECT: Record<LogoVariant, number> = {
  full: 729.411 / 125,
  stacked: 601.286 / 442.164,
  icon: 1,
  monogram: 1,
  wordmark: 601.286 / 104.173,
};

/** Path of a logo file. 'light' is drawn for an ivory ground and 'dark' for a graphite ground. */
export function logoSrc(variant: LogoVariant, theme: LogoTheme): string {
  return `/brand/logo/styra-${LOGO_FILES[variant]}-${theme}.svg`;
}

export const BRAND = {
  favicon: '/favicon.svg',
  ogImage: '/og-image.png',
} as const;

/** Logo heights in pixels for different contexts. The horizontal lockup must stay at least 24 px high. */
export const LOGO_SIZES = {
  /** Navbar desktop */
  navbarDesktop: { height: 28 },
  /** Navbar mobile */
  navbarMobile: { height: 24 },
  /** Auth page (login/register) */
  authPage: { height: 40 },
  /** Dashboard sidebar compact */
  dashboardCompact: { height: 24 },
  /** Dashboard expanded */
  dashboardExpanded: { height: 28 },
  /** Loading state (the mark alone) */
  loading: { height: 48 },
  /** Footer */
  footer: { height: 28 },
  /** Push notification icon */
  notification: { height: 192 },
} as const;

/** Brand name for alt text / aria labels */
export const BRAND_NAME = 'Styra';

/** The positioning line, used on the launch splash and the welcome screens. */
export const BRAND_TAGLINE = 'Your style, on demand.';

'use client';

import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { LAUNCH_MS, LAUNCH_SEEN_KEY } from '@/lib/launch';

/**
 * A calm brand reveal, once per browser session: the mark springs in, then the name and
 * tagline rise, then it dissolves. At most 1.2 s, it never blocks input, and any tap or key
 * skips it.
 *
 * It is server-rendered and animated by CSS alone (see "LAUNCH SPLASH" in globals.css), so it
 * is on screen at first paint and ends by itself even if scripts are slow. Reduced motion
 * skips it entirely. The guard script in layout.tsx hides it on later loads in a session.
 */
export function LaunchSplash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // The guard script sets data-launched before first paint when this session has seen it.
    const alreadySeen = document.documentElement.hasAttribute('data-launched');
    try {
      sessionStorage.setItem(LAUNCH_SEEN_KEY, '1');
    } catch {
      // Storage can be blocked. The splash then plays once per page load.
    }

    const hide = () => setGone(true);
    const timer = window.setTimeout(hide, alreadySeen ? 0 : LAUNCH_MS);
    window.addEventListener('pointerdown', hide, { once: true });
    window.addEventListener('keydown', hide, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('keydown', hide);
    };
  }, []);

  if (gone) return null;

  return (
    <div className="launch-splash" aria-hidden="true">
      <div className="launch-glow" />
      <div className="launch-lockup">
        <BrandLogo variant="icon" size={88} alt="" className="launch-mark" />
        <div className="launch-words">
          <span className="launch-name">{BRAND_NAME}</span>
          <span className="launch-tagline">{BRAND_TAGLINE}</span>
        </div>
      </div>
    </div>
  );
}

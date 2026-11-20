// The launch splash plays once per browser session. The key is written when it first plays.
// On later loads in the same session, the script below runs in <head> before first paint and
// marks <html data-launched>, which hides the splash, so a reload never flashes it again.
export const LAUNCH_SEEN_KEY = 'styra-launch-seen';

/** Milliseconds. The same as --duration-launch in globals.css, and the launch maximum in the motion spec. */
export const LAUNCH_MS = 1200;

export const launchGuardScript = `try{if(sessionStorage.getItem('${LAUNCH_SEEN_KEY}'))document.documentElement.setAttribute('data-launched','')}catch(e){}`;

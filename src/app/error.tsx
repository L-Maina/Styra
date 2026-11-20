'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// The raw message and stack are for developers. Visitors get a calm message and a reference code.
const SHOW_DETAILS = process.env.NODE_ENV !== 'production';

/**
 * Catches errors inside a page. It renders inside the root layout, so it must not
 * return its own <html> and <body> (only global-error.tsx does that).
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // The digest matches the entry in the server log
    console.error('[ERROR BOUNDARY] Caught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="max-w-lg w-full space-y-6 text-center">
        <div className="space-y-3">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">
            This page hit an unexpected problem. Trying again usually fixes it.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
        </div>

        {SHOW_DETAILS && (
          <details className="text-left bg-muted/50 rounded-lg p-4">
            <summary className="text-sm font-medium cursor-pointer hover:text-foreground">
              Error details (development only)
            </summary>
            <p className="mt-2 text-sm font-mono text-destructive break-all">{error.message}</p>
            {error.stack && (
              <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
          </details>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium transition-colors"
          >
            Go to home
          </button>
        </div>

        <button
          onClick={() => {
            // Last resort for a stuck screen: clear saved app state but keep the theme choice
            const theme = localStorage.getItem('theme');
            localStorage.clear();
            if (theme) localStorage.setItem('theme', theme);
            window.location.href = '/';
          }}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Still stuck? Reset saved data and reload
        </button>
      </div>
    </div>
  );
}

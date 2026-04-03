'use client';

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the full error to console for debugging
    console.error('[ERROR BOUNDARY] Caught error:', error);
    console.error('[ERROR BOUNDARY] Error message:', error.message);
    console.error('[ERROR BOUNDARY] Error stack:', error.stack);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. This has been logged for debugging.
            </p>
          </div>

          {/* Show the actual error for debugging */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Error Details:</p>
            <p className="text-sm font-mono text-destructive/80 break-all">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
            )}
          </div>

          {error.stack && (
            <details className="bg-muted/50 rounded-lg p-4">
              <summary className="text-sm font-medium cursor-pointer hover:text-foreground">
                Technical Details (Stack Trace)
              </summary>
              <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                // Clear all client state and reload
                if (typeof window !== 'undefined') {
                  localStorage.clear();
                  window.location.href = '/';
                }
              }}
              className="px-6 py-3 rounded-lg border border-border hover:bg-muted font-medium transition-colors"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Error Boundary]', error.message, error.stack);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">Something Went Wrong</h2>
        <div className="bg-muted rounded-lg p-4 text-left text-sm font-mono break-all max-h-48 overflow-auto">
          <p className="text-destructive font-medium">{error.message}</p>
          {error.digest && <p className="text-muted-foreground mt-2">Digest: {error.digest}</p>}
          {error.stack && (
            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{error.stack.slice(0, 500)}</pre>
          )}
        </div>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

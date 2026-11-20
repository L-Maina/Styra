'use client';

import './globals.css';
import { AlertTriangle } from 'lucide-react';

// The last-resort screen replaces the root layout, so it brings its own <html>, <body> and styles.
// The raw message is for developers; visitors get a calm message and a reference code.
const SHOW_DETAILS = process.env.NODE_ENV !== 'production';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="space-y-3">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
            <h1 className="text-2xl font-bold">Styra hit a problem</h1>
            <p className="text-muted-foreground">
              Something went wrong while loading the app. Trying again usually fixes it.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
            )}
          </div>

          {SHOW_DETAILS && (
            <p className="text-sm font-mono text-destructive break-all bg-muted/50 rounded-lg p-4 text-left">
              {error.message}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

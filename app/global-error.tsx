"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-4">
        <div className="paper-panel max-w-xl w-full p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl mb-2">Application error</h2>
          <p className="text-sm text-[var(--muted)] mb-2">A critical client-side exception occurred.</p>
          <p className="text-xs text-[var(--muted)] mb-6">{error.message}</p>
          <Button onClick={reset}>Reload</Button>
        </div>
      </body>
    </html>
  );
}

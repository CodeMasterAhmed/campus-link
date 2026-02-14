"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="paper-panel max-w-xl w-full p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="font-display text-2xl mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--muted)] mb-6">
          We could not complete this request. Please retry.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

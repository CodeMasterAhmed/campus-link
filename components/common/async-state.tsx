import { Loader2 } from "lucide-react";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-[220px] flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="min-h-[180px] flex items-center justify-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-[180px] flex items-center justify-center">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}

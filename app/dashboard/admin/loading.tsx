import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-[var(--primary)]" />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type SessionStatus = "authenticated" | "loading" | "unauthenticated";

export function useDelayedLoginRedirect(status: SessionStatus, delayMs = 800) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") return;

    const timeoutId = window.setTimeout(() => {
      router.replace("/login");
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, router, status]);
}

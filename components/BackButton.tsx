"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  className?: string;
  fallbackHref?: string;
  label?: string;
}

export function BackButton({
  className = "party-back-link",
  fallbackHref = "/",
  label = "Back"
}: BackButtonProps): React.JSX.Element {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {label}
    </button>
  );
}

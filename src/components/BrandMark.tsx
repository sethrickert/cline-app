import type { CSSProperties } from "react";

export function BrandMark({ size = 30, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 32 32"
      style={{ width: size, height: size, opacity: muted ? 0.72 : 1 } as CSSProperties}
    >
      <path d="M16 2.8 28 9.6v5.1l-7 4v-4.6l-5-2.8-6.2 3.5v7L16 25.3l5-2.8v-4.6l7-4v8.5L16 29.2 4 22.4V9.6L16 2.8Z" fill="currentColor" />
    </svg>
  );
}


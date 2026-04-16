import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-surface-container-lowest rounded-xl sticker-shadow border border-outline-variant/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

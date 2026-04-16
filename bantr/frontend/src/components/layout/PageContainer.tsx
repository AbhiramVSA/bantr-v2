import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("max-w-[1440px] mx-auto", className)}>{children}</div>;
}

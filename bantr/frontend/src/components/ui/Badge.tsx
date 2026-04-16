import type { DebateStatus } from "../../types/debate";
import { cn } from "../../utils/cn";

const statusClassMap: Record<DebateStatus, string> = {
  pending: "bg-[#fef08a] text-[#854d0e]",
  starting: "bg-primary-container text-on-primary-container",
  active: "bg-secondary-container text-on-secondary-container",
  ending: "bg-tertiary-container text-on-tertiary-container",
  completed: "bg-surface-container-high text-on-surface",
  failed: "bg-tertiary-container text-on-tertiary-container",
};

export function Badge({ status, className }: { status: DebateStatus; className?: string }) {
  return (
    <span
      className={cn(
        "px-4 py-1 rounded-full font-label font-bold text-xs uppercase tracking-wider",
        statusClassMap[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

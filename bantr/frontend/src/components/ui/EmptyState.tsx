import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-surface-container rounded-xl border-2 border-dashed border-primary/20 p-8 flex flex-col items-center justify-center text-center opacity-80">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-4xl text-primary-container">add_circle</span>
      </div>
      <p className="font-headline font-bold text-on-surface mb-2">{title}</p>
      <p className="text-sm text-on-surface-variant mb-6">{description}</p>
      {action}
    </div>
  );
}

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full bg-surface-container-low border-none rounded-2xl py-4 px-5 text-on-background placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-outline focus:bg-surface-container-lowest transition-all",
        className,
      )}
      {...props}
    />
  );
});

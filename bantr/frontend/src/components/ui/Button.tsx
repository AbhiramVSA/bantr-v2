import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClassName =
  "inline-flex items-center justify-center gap-2 rounded-full font-headline font-bold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary px-6 py-3 hover:scale-105 active:scale-95",
  secondary:
    "bg-secondary-fixed text-on-secondary-fixed px-6 py-3 hover:scale-105 active:scale-95",
  ghost:
    "bg-surface-container text-on-surface px-6 py-3 hover:bg-surface-container-high",
  danger:
    "bg-error text-on-error px-6 py-3 hover:scale-105 active:scale-95",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, type = "button", variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(baseClassName, variants[variant], className)}
      {...props}
    />
  );
});

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
  {
    variants: {
      variant: {
        primary: "bg-brand text-bg hover:bg-brand/90",
        secondary: "border border-line bg-card text-ink hover:bg-line/60",
        ghost: "text-ink-muted hover:bg-card hover:text-ink",
        danger: "border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        md: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-lg",
        sm: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };

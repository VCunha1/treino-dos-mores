import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormField({ label, name, error, hint, children, className }: Props) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
        {success}
      </p>
    );
  }
  return null;
}

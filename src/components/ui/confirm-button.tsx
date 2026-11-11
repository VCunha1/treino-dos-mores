"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: React.ReactNode;
  message: string;
  confirmLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
};

/** Operação destrutiva em duas etapas: primeiro pede confirmação, depois envia o formulário. */
export function ConfirmButton({
  action,
  fields,
  label,
  message,
  confirmLabel = "Confirmar",
  variant = "danger",
  size = "sm",
  className,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant={variant} size={size} className={className} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-sm">{message}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <SubmitButton variant="danger" size="sm" pendingText="Aguarde...">
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

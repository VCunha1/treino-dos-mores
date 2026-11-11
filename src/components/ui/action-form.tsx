import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonProps } from "@/components/ui/button";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

/** Formulário de um botão só, com campos ocultos. Funciona sem JavaScript no cliente. */
export function ActionForm({ action, fields, children, variant = "secondary", size = "sm", className, ariaLabel, disabled }: Props) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} className={className} aria-label={ariaLabel} disabled={disabled}>
        {children}
      </SubmitButton>
    </form>
  );
}

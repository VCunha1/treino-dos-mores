"use client";

import { useActionState } from "react";
import { FormField, FormMessage } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/types";

type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  hint?: string;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FieldDef[];
  submitLabel: string;
  pendingText: string;
};

export function AuthForm({ action, fields, submitLabel, pendingText }: Props) {
  const [state, formAction] = useActionState(action, {} as ActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {fields.map((f) => (
        <FormField key={f.name} label={f.label} name={f.name} error={state.fieldErrors?.[f.name]} hint={f.hint}>
          <input
            id={f.name}
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            required
            className="field"
            aria-invalid={Boolean(state.fieldErrors?.[f.name])}
          />
        </FormField>
      ))}
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" className="w-full" pendingText={pendingText}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

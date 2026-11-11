import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCustomExercise } from "@/features/plans/actions";
import { MUSCLES } from "@/lib/training";

export function CustomExerciseForm({ returnTo = "/exercicios" }: { returnTo?: string }) {
  return (
    <details className="rounded-2xl border border-line/70 bg-card p-4">
      <summary className="cursor-pointer font-semibold marker:content-none">+ Criar exercício personalizado</summary>
      <form action={createCustomExercise} className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <FormField label="Nome" name="name">
          <input id="name" name="name" required minLength={2} maxLength={80} className="field" />
        </FormField>
        <FormField label="Grupo muscular principal" name="primaryMuscle">
          <select id="primaryMuscle" name="primaryMuscle" required defaultValue="" className="field">
            <option value="" disabled>
              Escolha...
            </option>
            {MUSCLES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Equipamento (opcional)" name="equipment">
          <input id="equipment" name="equipment" maxLength={60} className="field" placeholder="Ex.: Halteres" />
        </FormField>
        <FormField label="Descrição (opcional)" name="description">
          <textarea id="description" name="description" rows={2} maxLength={500} className="field-area" />
        </FormField>
        <FormField label="Orientações de execução (opcional)" name="instructions">
          <textarea id="instructions" name="instructions" rows={3} maxLength={1000} className="field-area" />
        </FormField>
        <FormField label="Observações de segurança (opcional)" name="safetyNotes">
          <textarea id="safetyNotes" name="safetyNotes" rows={2} maxLength={500} className="field-area" />
        </FormField>
        <FormField label="Link de imagem ou vídeo (opcional)" name="mediaUrl" hint="Precisa começar com https://">
          <input id="mediaUrl" name="mediaUrl" type="url" maxLength={500} className="field" placeholder="https://..." />
        </FormField>
        <SubmitButton size="lg" className="w-full" pendingText="Salvando...">
          Salvar exercício
        </SubmitButton>
      </form>
    </details>
  );
}

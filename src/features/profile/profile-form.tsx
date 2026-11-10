"use client";

import { useActionState } from "react";
import { FormField, FormMessage } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { saveProfile } from "@/features/profile/actions";
import type { ActionState, Profile, ProfileDetails } from "@/types";

type Props = {
  profile: Pick<Profile, "display_name" | "avatar_url">;
  details: ProfileDetails | null;
  intent: "onboarding" | "edit";
};

export function ProfileForm({ profile, details, intent }: Props) {
  const [state, action] = useActionState(saveProfile, {} as ActionState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="intent" value={intent} />

      <div className="flex items-center gap-4">
        <Avatar name={profile.display_name} src={profile.avatar_url} className="h-20 w-20 text-xl" />
        <FormField label="Foto de perfil" name="avatar" error={err.avatar} hint="JPG, PNG ou WebP, até 2 MB." className="flex-1">
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
          />
        </FormField>
      </div>

      <FormField label="Nome" name="displayName" error={err.displayName}>
        <input id="displayName" name="displayName" defaultValue={profile.display_name} required className="field" autoComplete="name" />
      </FormField>

      <fieldset className="space-y-4 rounded-2xl border border-line/70 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Informações físicas (opcional, só você vê)
        </legend>
        <FormField label="Data de nascimento" name="birthDate" error={err.birthDate}>
          <input id="birthDate" name="birthDate" type="date" defaultValue={details?.birth_date ?? ""} className="field" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Altura (cm)" name="heightCm" error={err.heightCm}>
            <input id="heightCm" name="heightCm" inputMode="decimal" defaultValue={details?.height_cm ?? ""} className="field" />
          </FormField>
          <FormField label="Peso (kg)" name="weightKg" error={err.weightKg}>
            <input id="weightKg" name="weightKg" inputMode="decimal" defaultValue={details?.weight_kg ?? ""} className="field" />
          </FormField>
        </div>
      </fieldset>

      <FormField label="Objetivos de treino" name="trainingGoals" error={err.trainingGoals}>
        <textarea id="trainingGoals" name="trainingGoals" rows={3} defaultValue={details?.training_goals ?? ""} className="field-area" placeholder="Ex.: ganhar força, melhorar a constância..." />
      </FormField>
      <FormField label="Preferências de treino" name="trainingPreferences" error={err.trainingPreferences}>
        <textarea id="trainingPreferences" name="trainingPreferences" rows={3} defaultValue={details?.training_preferences ?? ""} className="field-area" placeholder="Ex.: treinos curtos, prefere treinar de manhã..." />
      </FormField>
      <FormField label="Equipamentos disponíveis" name="availableEquipment" error={err.availableEquipment}>
        <textarea id="availableEquipment" name="availableEquipment" rows={2} defaultValue={details?.available_equipment ?? ""} className="field-area" placeholder="Ex.: academia completa, halteres em casa..." />
      </FormField>

      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" className="w-full" pendingText="Salvando...">
        {intent === "onboarding" ? "Continuar" : "Salvar alterações"}
      </SubmitButton>
    </form>
  );
}

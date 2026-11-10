"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, profileSchema } from "@/lib/validation/profile";
import { fieldErrors, formString } from "@/lib/validation/helpers";
import type { ActionState } from "@/types";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    displayName: formString(formData, "displayName"),
    birthDate: formString(formData, "birthDate"),
    heightCm: formString(formData, "heightCm"),
    weightKg: formString(formData, "weightKg"),
    trainingGoals: formString(formData, "trainingGoals"),
    trainingPreferences: formString(formData, "trainingPreferences"),
    availableEquipment: formString(formData, "availableEquipment"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // O dono do registro é SEMPRE o usuário da sessão, nunca um id vindo do formulário.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let avatarUrl: string | undefined;
  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      return { fieldErrors: { avatar: "Use uma imagem JPG, PNG ou WebP." } };
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return { fieldErrors: { avatar: "A imagem pode ter no máximo 2 MB." } };
    }
    const path = `${user.id}/avatar-${Date.now()}.${EXT[file.type]}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return { error: "Não foi possível enviar a foto. Tente novamente." };
    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const d = parsed.data;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: d.displayName,
      onboarding_completed: true,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", user.id);
  if (profileError) return { error: "Não foi possível salvar o perfil. Tente novamente." };

  const { error: detailsError } = await supabase.from("profile_details").upsert(
    {
      user_id: user.id,
      birth_date: d.birthDate,
      height_cm: d.heightCm,
      weight_kg: d.weightKg,
      training_goals: d.trainingGoals,
      training_preferences: d.trainingPreferences,
      available_equipment: d.availableEquipment,
    },
    { onConflict: "user_id" },
  );
  if (detailsError) return { error: "Não foi possível salvar os dados de treino. Tente novamente." };

  revalidatePath("/", "layout");

  if (formString(formData, "intent") === "onboarding") redirect("/");
  return { success: "Perfil atualizado." };
}

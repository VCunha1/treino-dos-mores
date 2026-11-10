import { z } from "zod";

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), {
      message: `${label} deve estar entre ${min} e ${max}.`,
    })
    .transform((v) => (v === "" ? null : Number(v)));

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} pode ter no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." })
  .refine((v) => v === "" || (new Date(v) < new Date() && new Date(v) > new Date("1900-01-01")), {
    message: "Data de nascimento inválida.",
  })
  .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  displayName: z
    .string({ required_error: "Informe seu nome." })
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(60, "O nome pode ter no máximo 60 caracteres."),
  birthDate: optionalDate,
  heightCm: optionalNumber(50, 260, "A altura"),
  weightKg: optionalNumber(20, 400, "O peso"),
  trainingGoals: optionalText(500, "Os objetivos"),
  trainingPreferences: optionalText(500, "As preferências"),
  availableEquipment: optionalText(500, "Os equipamentos"),
});

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

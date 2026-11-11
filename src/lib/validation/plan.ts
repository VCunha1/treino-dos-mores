import { z } from "zod";
import { MUSCLE_VALUES, SPLIT_VALUES } from "@/lib/training";

export const uuid = z.string().uuid("Identificador inválido.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} pode ter no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), {
      message: `${label} deve estar entre ${min} e ${max}.`,
    })
    .transform((v) => (v === "" ? null : Number(v)));

export const planCreateSchema = z.object({
  ownerId: uuid,
  name: z.string().trim().min(1, "Informe o nome do plano.").max(80, "O nome pode ter no máximo 80 caracteres."),
  split: z.enum(SPLIT_VALUES, { errorMap: () => ({ message: "Escolha uma divisão." }) }),
  description: optionalText(500, "A descrição"),
});

export const planUpdateSchema = z.object({
  planId: uuid,
  name: z.string().trim().min(1, "Informe o nome do plano.").max(80, "O nome pode ter no máximo 80 caracteres."),
  description: optionalText(500, "A descrição"),
  goal: optionalText(200, "O objetivo"),
});

export const dayUpdateSchema = z.object({
  dayId: uuid,
  name: z.string().trim().min(1, "Informe o nome do dia.").max(60, "O nome pode ter no máximo 60 caracteres."),
  focus: optionalText(100, "O foco"),
  weekday: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-6]$/.test(v), { message: "Dia da semana inválido." })
    .transform((v) => (v === "" ? null : Number(v))),
});

export const planExerciseSchema = z.object({
  sets: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Séries deve ser um número entre 1 e 20.")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 20, "Séries deve ser um número entre 1 e 20."),
  reps: z.string().trim().min(1, "Informe as repetições.").max(20, "Repetições pode ter no máximo 20 caracteres."),
  initialLoadKg: optionalNumber(0, 1000, "A carga"),
  restSeconds: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "O descanso deve ser em segundos (0 a 900).")
    .transform(Number)
    .refine((n) => n >= 0 && n <= 900, "O descanso deve ser em segundos (0 a 900)."),
  notes: optionalText(300, "As observações"),
  specialTechnique: optionalText(100, "A técnica"),
  objective: optionalText(200, "O objetivo"),
});

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(80, "O nome pode ter no máximo 80 caracteres."),
  primaryMuscle: z.enum(MUSCLE_VALUES, { errorMap: () => ({ message: "Escolha o grupo muscular." }) }),
  equipment: optionalText(60, "O equipamento"),
  description: optionalText(500, "A descrição"),
  instructions: optionalText(1000, "As orientações"),
  safetyNotes: optionalText(500, "As observações de segurança"),
  mediaUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length <= 500 && /^https?:\/\//i.test(v)), { message: "Use um link começando com http:// ou https://." })
    .transform((v) => (v === "" ? null : v)),
});

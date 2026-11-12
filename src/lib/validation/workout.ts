import { z } from "zod";
import { uuid } from "@/lib/validation/plan";

/** Atualização de uma série vinda do cliente. Dados do navegador nunca são confiáveis. */
export const setPatchSchema = z.object({
  setId: uuid,
  reps: z.number().int().min(0).max(1000).nullable(),
  loadKg: z
    .number()
    .min(0)
    .max(1000)
    .nullable()
    .transform((v) => (v === null ? null : Math.round(v * 100) / 100)),
  completed: z.boolean(),
});

export const exerciseStatusSchema = z.object({
  sessionExerciseId: uuid,
  status: z.enum(["pending", "skipped"]),
});

export const finishSchema = z.object({
  sessionId: uuid,
  notes: z
    .string()
    .trim()
    .max(500, "As observações podem ter no máximo 500 caracteres.")
    .transform((v) => (v === "" ? null : v)),
});

export const preferencesSchema = z.object({
  defaultRestSeconds: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "O descanso padrão deve ser em segundos (10 a 600).")
    .transform(Number)
    .refine((n) => n >= 10 && n <= 600, "O descanso padrão deve ser em segundos (10 a 600)."),
  soundEnabled: z.boolean(),
});

export function workoutErrorMessage(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("session_in_progress")) return "Você já tem um treino em andamento.";
  if (m.includes("empty_day")) return "Este dia ainda não tem exercícios. Adicione ao menos um para treinar.";
  if (m.includes("no_sets_completed")) return "Conclua pelo menos uma série antes de finalizar, ou descarte o treino.";
  if (m.includes("session_not_active")) return "Este treino já foi finalizado.";
  if (m.includes("forbidden") || m.includes("row-level security")) return "Você não tem permissão para essa ação.";
  return "Não foi possível concluir a ação. Tente novamente.";
}

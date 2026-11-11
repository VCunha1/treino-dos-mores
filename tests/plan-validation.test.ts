import { describe, expect, it } from "vitest";
import { splitDays, formatRest, muscleLabel, weekdayLabel } from "@/lib/training";
import { customExerciseSchema, dayUpdateSchema, planCreateSchema, planExerciseSchema } from "@/lib/validation/plan";

const id = "6f9619ff-8b86-d011-b42d-00cf4fc964ff";

describe("validação de plano", () => {
  it("aceita um plano válido e normaliza a descrição vazia", () => {
    const r = planCreateSchema.parse({ ownerId: id, name: " Hipertrofia ", split: "abc", description: "" });
    expect(r.name).toBe("Hipertrofia");
    expect(r.description).toBeNull();
  });

  it("rejeita divisão desconhecida, nome vazio e id inválido", () => {
    expect(planCreateSchema.safeParse({ ownerId: id, name: "x", split: "xyz", description: "" }).success).toBe(false);
    expect(planCreateSchema.safeParse({ ownerId: id, name: "  ", split: "abc", description: "" }).success).toBe(false);
    expect(planCreateSchema.safeParse({ ownerId: "nao-e-uuid", name: "x", split: "abc", description: "" }).success).toBe(false);
  });

  it("cada divisão gera a quantidade esperada de dias", () => {
    expect(splitDays("abc")).toHaveLength(3);
    expect(splitDays("abcd")).toHaveLength(4);
    expect(splitDays("abcde")).toHaveLength(5);
    expect(splitDays("upper_lower")).toEqual(["Upper", "Lower"]);
    expect(splitDays("push_pull_legs")).toEqual(["Push", "Pull", "Legs"]);
    expect(splitDays("full_body")).toHaveLength(1);
    expect(splitDays("desconhecida")).toEqual(["Treino 1"]);
  });
});

describe("validação de exercício do plano", () => {
  const base = { sets: "3", reps: "8-12", initialLoadKg: "", restSeconds: "90", notes: "", specialTechnique: "", objective: "" };

  it("converte números e campos vazios", () => {
    const r = planExerciseSchema.parse({ ...base, initialLoadKg: "42,5" });
    expect(r.sets).toBe(3);
    expect(r.restSeconds).toBe(90);
    expect(r.initialLoadKg).toBe(42.5);
    expect(r.notes).toBeNull();
  });

  it("rejeita séries, descanso e carga fora do limite", () => {
    expect(planExerciseSchema.safeParse({ ...base, sets: "0" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, sets: "21" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, sets: "abc" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, restSeconds: "901" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, restSeconds: "-5" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, initialLoadKg: "5000" }).success).toBe(false);
    expect(planExerciseSchema.safeParse({ ...base, reps: "" }).success).toBe(false);
  });
});

describe("validação de dia", () => {
  it("dia da semana opcional entre 0 e 6", () => {
    expect(dayUpdateSchema.parse({ dayId: id, name: "A", focus: "", weekday: "" }).weekday).toBeNull();
    expect(dayUpdateSchema.parse({ dayId: id, name: "A", focus: "", weekday: "3" }).weekday).toBe(3);
    expect(dayUpdateSchema.safeParse({ dayId: id, name: "A", focus: "", weekday: "7" }).success).toBe(false);
  });
});

describe("validação de exercício personalizado", () => {
  const base = { name: "Remada", primaryMuscle: "costas", equipment: "", description: "", instructions: "", safetyNotes: "", mediaUrl: "" };

  it("aceita exercício válido", () => {
    expect(customExerciseSchema.safeParse(base).success).toBe(true);
    expect(customExerciseSchema.safeParse({ ...base, mediaUrl: "https://exemplo.com/video" }).success).toBe(true);
  });

  it("rejeita grupo muscular inválido e links que não sejam http(s)", () => {
    expect(customExerciseSchema.safeParse({ ...base, primaryMuscle: "cabeca" }).success).toBe(false);
    expect(customExerciseSchema.safeParse({ ...base, mediaUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(customExerciseSchema.safeParse({ ...base, mediaUrl: "ftp://x.com" }).success).toBe(false);
  });
});

describe("formatação", () => {
  it("formata descanso, grupo muscular e dia da semana", () => {
    expect(formatRest(45)).toBe("45s");
    expect(formatRest(90)).toBe("1min 30s");
    expect(formatRest(120)).toBe("2min");
    expect(muscleLabel("posterior_coxa")).toBe("Posterior de coxa");
    expect(weekdayLabel(1)).toBe("Segunda");
    expect(weekdayLabel(null)).toBeNull();
  });
});

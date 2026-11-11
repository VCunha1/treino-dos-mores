export const MUSCLES = [
  { value: "peitoral", label: "Peitoral" },
  { value: "costas", label: "Costas" },
  { value: "ombros", label: "Ombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "antebraco", label: "Antebraço" },
  { value: "quadriceps", label: "Quadríceps" },
  { value: "posterior_coxa", label: "Posterior de coxa" },
  { value: "gluteos", label: "Glúteos" },
  { value: "panturrilhas", label: "Panturrilhas" },
  { value: "abdomen", label: "Abdômen" },
  { value: "outros", label: "Outros" },
] as const;

export type Muscle = (typeof MUSCLES)[number]["value"];
export const MUSCLE_VALUES = MUSCLES.map((m) => m.value) as [Muscle, ...Muscle[]];

export function muscleLabel(value: string): string {
  return MUSCLES.find((m) => m.value === value)?.label ?? value;
}

export const SPLITS = [
  { value: "abc", label: "ABC", days: ["Treino A", "Treino B", "Treino C"] },
  { value: "abcd", label: "ABCD", days: ["Treino A", "Treino B", "Treino C", "Treino D"] },
  { value: "abcde", label: "ABCDE", days: ["Treino A", "Treino B", "Treino C", "Treino D", "Treino E"] },
  { value: "upper_lower", label: "Upper / Lower", days: ["Upper", "Lower"] },
  { value: "push_pull_legs", label: "Push / Pull / Legs", days: ["Push", "Pull", "Legs"] },
  { value: "full_body", label: "Full Body", days: ["Full Body"] },
  { value: "custom", label: "Personalizada", days: ["Treino 1"] },
] as const;

export type SplitType = (typeof SPLITS)[number]["value"];
export const SPLIT_VALUES = SPLITS.map((s) => s.value) as [SplitType, ...SplitType[]];

export function splitLabel(value: string): string {
  return SPLITS.find((s) => s.value === value)?.label ?? value;
}

export function splitDays(value: string): string[] {
  return [...(SPLITS.find((s) => s.value === value)?.days ?? ["Treino 1"])];
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export function weekdayLabel(n: number | null | undefined): string | null {
  return n === null || n === undefined ? null : (WEEKDAYS[n] ?? null);
}

export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

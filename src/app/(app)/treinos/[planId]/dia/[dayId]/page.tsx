import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { PageAlert } from "@/components/ui/page-alert";
import { CustomExerciseForm } from "@/features/exercises/custom-exercise-form";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { ExerciseFilters } from "@/features/exercises/exercise-filters";
import { addPlanExercise } from "@/features/plans/actions";
import { MUSCLE_VALUES } from "@/lib/training";
import { uuid } from "@/lib/validation/plan";
import { getPlan, listExercises } from "@/services/plans";
import { requireUser } from "@/services/session";

export const metadata = { title: "Adicionar exercício" };

export default async function AddExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string; dayId: string }>;
  searchParams: Promise<{ m?: string; q?: string; erro?: string }>;
}) {
  const { planId, dayId } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(planId).success || !uuid.safeParse(dayId).success) notFound();

  const [user, plan] = await Promise.all([requireUser(), getPlan(planId)]);
  const day = plan?.days.find((d) => d.id === dayId);
  if (!plan || !day) notFound();

  const muscle = (MUSCLE_VALUES as readonly string[]).includes(sp.m ?? "") ? sp.m : undefined;
  const q = (sp.q ?? "").slice(0, 60);
  const exercises = await listExercises({ muscle, q });
  const basePath = `/treinos/${planId}/dia/${dayId}`;
  const alreadyIn = new Set(day.exercises.map((e) => e.exercise_id));

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/treinos/${planId}#dia-${dayId}`} className="text-sm text-ink-muted hover:text-brand">
          ← {plan.name}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Adicionar a {day.name}</h1>
      </div>

      <PageAlert error={sp.erro} />
      <ExerciseFilters basePath={basePath} muscle={muscle} q={q} />
      <CustomExerciseForm returnTo={basePath} />

      {exercises.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Nenhum exercício encontrado.
        </p>
      ) : (
        <ul className="space-y-3">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              currentUserId={user.id}
              footer={
                <ActionForm
                  action={addPlanExercise}
                  fields={{ planId, dayId, exerciseId: ex.id }}
                  variant={alreadyIn.has(ex.id) ? "secondary" : "primary"}
                  size="md"
                  className="w-full"
                >
                  {alreadyIn.has(ex.id) ? "Adicionar novamente" : "Adicionar ao treino"}
                </ActionForm>
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

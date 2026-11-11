import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageAlert } from "@/components/ui/page-alert";
import { CustomExerciseForm } from "@/features/exercises/custom-exercise-form";
import { ExerciseCard } from "@/features/exercises/exercise-card";
import { ExerciseFilters } from "@/features/exercises/exercise-filters";
import { deleteCustomExercise } from "@/features/plans/actions";
import { MUSCLE_VALUES } from "@/lib/training";
import { listExercises } from "@/services/plans";
import { requireUser } from "@/services/session";

export const metadata = { title: "Biblioteca de exercícios" };

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; q?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const muscle = (MUSCLE_VALUES as readonly string[]).includes(sp.m ?? "") ? sp.m : undefined;
  const q = (sp.q ?? "").slice(0, 60);
  const exercises = await listExercises({ muscle, q });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Biblioteca</h1>
      <PageAlert error={sp.erro} />
      <ExerciseFilters basePath="/exercicios" muscle={muscle} q={q} />
      <CustomExerciseForm />

      {exercises.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Nenhum exercício encontrado. Tente outro filtro ou crie um exercício personalizado.
        </p>
      ) : (
        <ul className="space-y-3">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              currentUserId={user.id}
              footer={
                ex.owner_id === user.id ? (
                  <ConfirmButton
                    action={deleteCustomExercise}
                    fields={{ exerciseId: ex.id }}
                    label="Remover"
                    message="Remover este exercício da biblioteca? Se ele estiver em algum plano, a remoção será bloqueada."
                    confirmLabel="Remover"
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

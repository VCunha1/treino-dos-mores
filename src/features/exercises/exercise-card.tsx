import { muscleLabel } from "@/lib/training";
import type { Exercise } from "@/types/training";

export function ExerciseCard({
  exercise,
  currentUserId,
  footer,
}: {
  exercise: Exercise;
  currentUserId: string;
  footer?: React.ReactNode;
}) {
  const origin =
    exercise.owner_id === null ? null : exercise.owner_id === currentUserId ? "Criado por você" : "Criado pelo casal";
  const hasDetails = exercise.description || exercise.instructions || exercise.safety_notes || exercise.media_url;

  return (
    <li className="rounded-2xl border border-line/70 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{exercise.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {muscleLabel(exercise.primary_muscle)}
            {exercise.equipment ? ` · ${exercise.equipment}` : ""}
          </p>
        </div>
        {origin ? (
          <span className="shrink-0 rounded-full border border-brand/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {origin}
          </span>
        ) : null}
      </div>

      {hasDetails ? (
        <details className="group mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-brand marker:content-none">Ver detalhes</summary>
          <div className="mt-2 space-y-2 text-ink-muted">
            {exercise.secondary_muscles.length > 0 ? (
              <p>
                <span className="text-ink">Secundários: </span>
                {exercise.secondary_muscles.map(muscleLabel).join(", ")}
              </p>
            ) : null}
            {exercise.description ? <p>{exercise.description}</p> : null}
            {exercise.instructions ? (
              <p>
                <span className="text-ink">Execução: </span>
                {exercise.instructions}
              </p>
            ) : null}
            {exercise.safety_notes ? (
              <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                <span className="font-semibold">Segurança: </span>
                {exercise.safety_notes}
              </p>
            ) : null}
            {exercise.media_url ? (
              <a
                href={exercise.media_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-block text-brand underline"
              >
                Ver demonstração
              </a>
            ) : null}
          </div>
        </details>
      ) : null}

      {footer ? <div className="mt-3">{footer}</div> : null}
    </li>
  );
}

import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteDay,
  deletePlanExercise,
  moveDay,
  movePlanExercise,
  updateDay,
  updatePlanExercise,
} from "@/features/plans/actions";
import { formatRest, muscleLabel, WEEKDAYS, weekdayLabel } from "@/lib/training";
import type { PlanDay, PlanExercise } from "@/types/training";

function ExerciseItem({
  item,
  planId,
  dayId,
  canManage,
  isFirst,
  isLast,
}: {
  item: PlanExercise;
  planId: string;
  dayId: string;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="rounded-xl border border-line/60 bg-surface p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{item.exercise?.name ?? "Exercício removido"}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {item.sets} × {item.reps}
            {item.initial_load_kg !== null ? ` · ${item.initial_load_kg} kg` : ""} · descanso {formatRest(item.rest_seconds)}
            {item.exercise ? ` · ${muscleLabel(item.exercise.primary_muscle)}` : ""}
          </p>
          {item.special_technique ? <p className="mt-1 text-xs text-brand">Técnica: {item.special_technique}</p> : null}
          {item.objective ? <p className="text-xs text-ink-muted">Objetivo: {item.objective}</p> : null}
          {item.notes ? <p className="text-xs text-ink-muted">Obs.: {item.notes}</p> : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <ActionForm
              action={movePlanExercise}
              fields={{ planId, dayId, itemId: item.id, dir: "up" }}
              variant="ghost"
              ariaLabel="Mover para cima"
              disabled={isFirst}
              className="h-10 w-10 px-0"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </ActionForm>
            <ActionForm
              action={movePlanExercise}
              fields={{ planId, dayId, itemId: item.id, dir: "down" }}
              variant="ghost"
              ariaLabel="Mover para baixo"
              disabled={isLast}
              className="h-10 w-10 px-0"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </ActionForm>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-brand marker:content-none">Editar</summary>
          <form action={updatePlanExercise} className="mt-3 space-y-3">
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="itemId" value={item.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Séries" name={`sets-${item.id}`}>
                <input id={`sets-${item.id}`} name="sets" inputMode="numeric" defaultValue={item.sets} required className="field" />
              </FormField>
              <FormField label="Repetições" name={`reps-${item.id}`}>
                <input id={`reps-${item.id}`} name="reps" defaultValue={item.reps} required maxLength={20} className="field" placeholder="8-12" />
              </FormField>
              <FormField label="Carga inicial (kg)" name={`load-${item.id}`}>
                <input id={`load-${item.id}`} name="initialLoadKg" inputMode="decimal" defaultValue={item.initial_load_kg ?? ""} className="field" />
              </FormField>
              <FormField label="Descanso (s)" name={`rest-${item.id}`}>
                <input id={`rest-${item.id}`} name="restSeconds" inputMode="numeric" defaultValue={item.rest_seconds} required className="field" />
              </FormField>
            </div>
            <FormField label="Técnica especial" name={`tech-${item.id}`}>
              <input id={`tech-${item.id}`} name="specialTechnique" defaultValue={item.special_technique ?? ""} maxLength={100} className="field" placeholder="Ex.: drop set, rest-pause" />
            </FormField>
            <FormField label="Objetivo do exercício" name={`obj-${item.id}`}>
              <input id={`obj-${item.id}`} name="objective" defaultValue={item.objective ?? ""} maxLength={200} className="field" />
            </FormField>
            <FormField label="Observações" name={`notes-${item.id}`}>
              <textarea id={`notes-${item.id}`} name="notes" rows={2} defaultValue={item.notes ?? ""} maxLength={300} className="field-area" />
            </FormField>
            <SubmitButton className="w-full" pendingText="Salvando...">
              Salvar exercício
            </SubmitButton>
          </form>
          <div className="mt-3">
            <ConfirmButton
              action={deletePlanExercise}
              fields={{ planId, itemId: item.id }}
              label="Remover do treino"
              message="Remover este exercício do treino?"
              confirmLabel="Remover"
            />
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function PlanDayCard({
  day,
  planId,
  canManage,
  isFirst,
  isLast,
  isOnlyDay,
}: {
  day: PlanDay;
  planId: string;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOnlyDay: boolean;
}) {
  const weekday = weekdayLabel(day.weekday);

  return (
    <section id={`dia-${day.id}`} className="scroll-mt-4 rounded-2xl border border-line/70 bg-card p-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">{day.name}</h3>
          <p className="text-xs text-ink-muted">
            {[weekday, day.focus, `${day.exercises.length} exercício${day.exercises.length === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <ActionForm
              action={moveDay}
              fields={{ planId, dayId: day.id, dir: "up" }}
              variant="ghost"
              ariaLabel="Mover dia para cima"
              disabled={isFirst}
              className="h-10 w-10 px-0"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </ActionForm>
            <ActionForm
              action={moveDay}
              fields={{ planId, dayId: day.id, dir: "down" }}
              variant="ghost"
              ariaLabel="Mover dia para baixo"
              disabled={isLast}
              className="h-10 w-10 px-0"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </ActionForm>
          </div>
        ) : null}
      </header>

      {canManage ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-brand marker:content-none">Editar dia</summary>
          <form action={updateDay} className="mt-3 space-y-3">
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="dayId" value={day.id} />
            <FormField label="Nome do dia" name={`dname-${day.id}`}>
              <input id={`dname-${day.id}`} name="name" defaultValue={day.name} required maxLength={60} className="field" />
            </FormField>
            <FormField label="Foco (opcional)" name={`dfocus-${day.id}`}>
              <input id={`dfocus-${day.id}`} name="focus" defaultValue={day.focus ?? ""} maxLength={100} className="field" placeholder="Ex.: Peito e tríceps" />
            </FormField>
            <FormField label="Dia da semana (opcional)" name={`dweek-${day.id}`}>
              <select id={`dweek-${day.id}`} name="weekday" defaultValue={day.weekday === null ? "" : String(day.weekday)} className="field">
                <option value="">Sem dia fixo</option>
                {WEEKDAYS.map((w, i) => (
                  <option key={w} value={i}>
                    {w}
                  </option>
                ))}
              </select>
            </FormField>
            <SubmitButton className="w-full" pendingText="Salvando...">
              Salvar dia
            </SubmitButton>
          </form>
          {!isOnlyDay ? (
            <div className="mt-3">
              <ConfirmButton
                action={deleteDay}
                fields={{ planId, dayId: day.id }}
                label="Excluir dia"
                message="Excluir este dia e todos os exercícios dele?"
                confirmLabel="Excluir"
              />
            </div>
          ) : null}
        </details>
      ) : null}

      {day.exercises.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">
          Nenhum exercício neste dia ainda.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {day.exercises.map((item, i) => (
            <ExerciseItem
              key={item.id}
              item={item}
              planId={planId}
              dayId={day.id}
              canManage={canManage}
              isFirst={i === 0}
              isLast={i === day.exercises.length - 1}
            />
          ))}
        </ul>
      )}

      {canManage ? (
        <Link
          href={`/treinos/${planId}/dia/${day.id}`}
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl border border-brand/50 font-semibold text-brand transition active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" aria-hidden /> Adicionar exercício
        </Link>
      ) : null}
    </section>
  );
}

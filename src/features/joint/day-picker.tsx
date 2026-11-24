import { Dumbbell } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TrainableDay } from "@/types/joint";

/** Lista os dias de treino disponíveis; cada um é um formulário que envia o dia escolhido. */
export function DayPicker({
  days,
  action,
  fields,
  buttonLabel,
}: {
  days: TrainableDay[];
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  buttonLabel: string;
}) {
  if (days.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted">
        Você ainda não tem um treino com exercícios. Crie um plano em <strong>Treinos</strong> para poder treinar junto.
      </p>
    );
  }

  const byPlan = new Map<string, TrainableDay[]>();
  for (const d of days) byPlan.set(d.planName, [...(byPlan.get(d.planName) ?? []), d]);

  return (
    <div className="space-y-4">
      {[...byPlan.entries()].map(([plan, list]) => (
        <div key={plan} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{plan}</h3>
          <ul className="space-y-2">
            {list.map((d) => (
              <li key={d.dayId}>
                <form action={action} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-card p-3">
                  <input type="hidden" name="dayId" value={d.dayId} />
                  {Object.entries(fields ?? {}).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Dumbbell className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.dayName}</span>
                    <span className="block text-xs text-ink-muted">
                      {d.exerciseCount} exercício{d.exerciseCount > 1 ? "s" : ""}
                      {d.focus ? ` · ${d.focus}` : ""}
                    </span>
                  </span>
                  <SubmitButton size="sm" pendingText="...">
                    {buttonLabel}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageAlert } from "@/components/ui/page-alert";
import { deleteSession } from "@/features/workout/actions";
import { muscleLabel } from "@/lib/training";
import { uuid } from "@/lib/validation/plan";
import { formatDuration, formatLoad, formatVolume } from "@/lib/workout-client";
import { getSessionDetail } from "@/services/workouts";

export const metadata = { title: "Treino realizado" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function HistoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ concluido?: string; erro?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(sessionId).success) notFound();

  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();
  if (detail.status === "in_progress") redirect(`/treino/${sessionId}`);

  const seconds = detail.ended_at ? (Date.parse(detail.ended_at) - Date.parse(detail.started_at)) / 1000 : 0;
  const performed = detail.exercises.filter((e) => e.sets.some((s) => s.completed));
  const skipped = detail.exercises.filter((e) => !e.sets.some((s) => s.completed));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/historico" className="text-sm text-ink-muted hover:text-brand">
          ← Histórico
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight">{detail.day_name}</h1>
        <p className="text-sm capitalize text-ink-muted">
          {detail.plan_name} · {dateFmt.format(new Date(detail.started_at))}
        </p>
      </div>

      <PageAlert error={sp.erro} notice={sp.concluido ? "Treino finalizado e salvo no seu histórico. Bom trabalho!" : undefined} />

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-line/70 bg-card p-3">
          <dt className="text-[11px] uppercase tracking-wider text-ink-muted">Duração</dt>
          <dd className="mt-1 font-display text-lg font-bold">{formatDuration(seconds)}</dd>
        </div>
        <div className="rounded-2xl border border-line/70 bg-card p-3">
          <dt className="text-[11px] uppercase tracking-wider text-ink-muted">Séries</dt>
          <dd className="mt-1 font-display text-lg font-bold">{detail.sets_completed ?? 0}</dd>
        </div>
        <div className="rounded-2xl border border-line/70 bg-card p-3">
          <dt className="text-[11px] uppercase tracking-wider text-ink-muted">Volume</dt>
          <dd className="mt-1 font-display text-lg font-bold">{formatVolume(detail.total_volume_kg)}</dd>
        </div>
      </dl>

      {detail.notes ? (
        <section className="rounded-2xl border border-line/70 bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Observações</h2>
          <p className="mt-1 text-sm">{detail.notes}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        {performed.map((ex) => (
          <article key={ex.id} className="rounded-2xl border border-line/70 bg-card p-4">
            <h3 className="font-semibold leading-snug">{ex.exercise_name}</h3>
            <p className="text-xs text-ink-muted">{muscleLabel(ex.primary_muscle)}</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="pb-1 font-medium">Série</th>
                  <th className="pb-1 font-medium">Reps</th>
                  <th className="pb-1 text-right font-medium">Carga</th>
                </tr>
              </thead>
              <tbody>
                {ex.sets
                  .filter((s) => s.completed)
                  .map((s) => (
                    <tr key={s.id} className="border-t border-line/50">
                      <td className="py-1.5">{s.set_number}</td>
                      <td className="py-1.5">{s.reps ?? "—"}</td>
                      <td className="py-1.5 text-right">{s.load_kg === null ? "—" : `${formatLoad(s.load_kg)} kg`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </article>
        ))}
        {skipped.length > 0 ? (
          <p className="text-xs text-ink-muted">Sem séries concluídas: {skipped.map((e) => e.exercise_name).join(", ")}.</p>
        ) : null}
      </section>

      <ConfirmButton
        action={deleteSession}
        fields={{ sessionId: detail.id }}
        label="Excluir este treino do histórico"
        message="Excluir este treino do histórico? As séries registradas serão apagadas."
        confirmLabel="Excluir"
        size="md"
        className="w-full"
      />
    </div>
  );
}

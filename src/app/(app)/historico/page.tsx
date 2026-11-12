import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageAlert } from "@/components/ui/page-alert";
import { ActiveSessionBanner } from "@/features/workout/active-session-banner";
import { formatDuration, formatVolume } from "@/lib/workout-client";
import { getActiveSession, listCompletedSessions } from "@/services/workouts";

export const metadata = { title: "Histórico" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const [sessions, active] = await Promise.all([listCompletedSessions(), getActiveSession()]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Histórico</h1>
      <PageAlert error={erro} />
      <ActiveSessionBanner session={active} />

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="text-sm text-ink-muted">Você ainda não finalizou nenhum treino.</p>
          <Link href="/treinos" className="mt-3 inline-block font-semibold text-brand">
            Ir para meus treinos
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {sessions.length} treino{sessions.length === 1 ? "" : "s"} registrado{sessions.length === 1 ? "" : "s"}.
          </p>
          <ul className="space-y-3">
            {sessions.map((s) => {
              const seconds = s.ended_at ? (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 1000 : 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/historico/${s.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line/70 bg-card p-4 transition active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.day_name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {s.plan_name} · {dateFmt.format(new Date(s.started_at))}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatDuration(seconds)} · {s.sets_completed ?? 0} séries · {formatVolume(s.total_volume_kg)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { Play } from "lucide-react";
import type { WorkoutSession } from "@/types/workout";

/** Aviso para continuar um treino interrompido (fechou o navegador, atualizou a página, etc.). */
export function ActiveSessionBanner({ session }: { session: WorkoutSession | null }) {
  if (!session) return null;
  return (
    <Link
      href={`/treino/${session.id}`}
      className="flex items-center gap-3 rounded-2xl border border-brand bg-brand/10 p-4 transition active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-bg">
        <Play className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand">Treino em andamento</span>
        <span className="block truncate font-semibold">
          {session.day_name} · {session.plan_name}
        </span>
        <span className="block text-xs text-ink-muted">Toque para continuar de onde parou</span>
      </span>
    </Link>
  );
}

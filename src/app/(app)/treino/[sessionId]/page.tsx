import { notFound, redirect } from "next/navigation";
import { WorkoutRunner } from "@/features/workout/workout-runner";
import { uuid } from "@/lib/validation/plan";
import { getPreferences, getSessionDetail } from "@/services/workouts";

export const metadata = { title: "Treino em andamento" };

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  if (!uuid.safeParse(sessionId).success) notFound();

  // A RLS garante que só o dono enxerga a sessão; qualquer outro recebe "não encontrado".
  const [detail, prefs] = await Promise.all([getSessionDetail(sessionId), getPreferences()]);
  if (!detail) notFound();
  if (detail.status === "completed") redirect(`/historico/${sessionId}`);

  return (
    <WorkoutRunner
      session={{ id: detail.id, planName: detail.plan_name, dayName: detail.day_name, startedAt: detail.started_at }}
      exercises={detail.exercises}
      defaultRestSeconds={prefs.default_rest_seconds}
      soundEnabled={prefs.sound_enabled}
      notice={sp.aviso === "em-andamento" ? "Você já tinha um treino em andamento. Retomamos ele para você." : undefined}
      error={sp.erro}
    />
  );
}
